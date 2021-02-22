const userEco = require('../../db/models/userEcoModel');
const helper = require('../../util/helper')

module.exports = {
    name: 'pay',
    description: 'Pay a user from your balance',
    guildOnly: true,
    args: true,
    cooldown: 15,
    async execute(message, args) {
        if (args.length < 2) {
            return message.channel.send('Not enough arguments provided.');
        }

        let payer = message.author;
        let payee = await helper.queryUser(message, args);
        let amount = parseInt(args[1]);

        if (amount < 0) {
            return message.channel.send('Can not send negative money.');   
        }

        let payerAccount = await helper.getUserEcoAccount(payer.id);
        let payeeAccount = await helper.getUserEcoAccount(payee.id);

        if (payerAccount.balance < amount) {
            return message.channel.send(`You need ${amount-payerAccount.balance} more [insertEmoteHere].`);
        }

        let payerNewBalance = payerAccount.balance - amount;
        let payeeNewBalance = payeeAccount.balance + amount;

        await userEco.updateOne({
            userId: payer.id
        }, {
            balance: payerNewBalance
        })

        await userEco.updateOne({
            userId: payee.id
        }, {
            balance: payeeNewBalance
        })

        return message.channel.send(`Successfully sent ${amount} ${helper.getMoneyEmoji(message)} to ${payee}`);
    }
}