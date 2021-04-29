import { Client } from "discord.js";
import { parse } from "dotenv";
import { readFileSync } from "fs";
import { MongoClient } from "mongodb";
import { getCommand } from "./commands";
import { isConfig } from "./config";
import { isDotEnv } from "./dotEnv";
import { ephemeral } from "./ephemeral";
import type { State } from "./state";

// USAGE: npm start [configPath] [envPath]
const configPath = process.argv[2] ?? "config.json";
const envPath = process.argv[3] ?? ".env";

function main(state: State) {
	const { config, discordClient } = state;

	discordClient.on("ready", () => {
		discordClient.user
			?.setActivity(state.version, { type: "PLAYING" })
			.then(presence => console.log(`Activity set to ${presence.activities[0].name}`))
			.catch(console.error);
	});

	discordClient.on("message", message => {
		if (message.author.bot) {
			// Do not process bot messages.
			return;
		}

		if (message.channel.id === config.showcaseChannelId) {
			// Handle showcase.
			if (message.attachments.size === 0 && !/https?:\/\//.test(message.content)) {
				// Ensure messages in showcase contain an attachment or link.
				if (!message.member?.roles.cache.has(config.staffRoleId)) {
					message.delete().catch(console.error);
					return; // Do not do any further processing.
				}
			} else {
				// Add up vote and down vote reaction to message.
				// TODO: make emotes configurable in the future?
				message.react("👍").catch(console.error);
				message.react("👎").catch(console.error);
			}
		}

		if (message.content.startsWith(config.commandPrefix)) {
			// Handle commands.
			// TODO: https://github.com/RSA-Bots/PandaProtector/issues/3
			const content = message.content.slice(config.commandPrefix.length);
			const matches = /^(\w+)\s*(.*)/su.exec(content);
			const commandName = matches?.[1]?.toLowerCase() ?? "";
			const argumentContent = matches?.[2] ?? "";

			if (commandName.length > 0) {
				const command = getCommand(commandName);

				if (command && command.hasPermission(state, message)) {
					const args = command.parseArguments(argumentContent);
					const required = command.options.reduce((acc, option) => acc + (option.optional ? 0 : 1), 0);

					if (args.length >= required) {
						command.handler(state, message, ...command.parseArguments(argumentContent));
					} else {
						ephemeral(state, message.reply(`Missing arguments for **${commandName}**.`)).catch(
							console.error
						);
					}
				}
			}
		}
	});

	// TODO: https://github.com/RSA-Bots/PandaProtector/issues/4
	discordClient.on("guildMemberUpdate", member => {
		if (member.roles.cache.array().length == 1) {
			// Give user the member role.
			member.roles.add(config.memberRoleId).catch(console.error);
		}
	});
}

try {
	const config = JSON.parse(readFileSync(configPath, "utf-8")) as unknown;
	const dotEnv = readFileSync(envPath, "utf-8");
	const version = (JSON.parse(readFileSync("package.json", "utf-8")) as { version: string })["version"];

	if (!isConfig(config)) {
		throw new Error("Config file does not match the Config interface.");
	}

	const env = parse(dotEnv);

	if (!isDotEnv(env)) {
		throw new Error("Environment file does not match the DotEnv interface.");
	}

	// Connect to the database.
	void MongoClient.connect(env.dbUri, { ssl: true, useUnifiedTopology: true }).then(mongoClient => {
		// Connect to Discord.
		const discordClient = new Client();
		void discordClient.login(env.token).then(() => main({ version, config, discordClient, mongoClient }));
	});
} catch (e) {
	console.error(e);
}
