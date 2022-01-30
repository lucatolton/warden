const { Client, Intents, Discord } = require('discord.js');
const signale = require('signale');
const pool = require('./pool');
const { MessageActionRow, MessageButton, MessageEmbed, Interactions } = require('discord.js');
const config = require('./config.json');

const botIntents = new Intents();
botIntents.add(Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES);

const client = new Client({ intents: botIntents });
const log = new signale.Signale({ scope: 'Bot' });

function main() {
    log.pending('Waiting for bot to login...');
    client.login(config.discord.token).catch(() => {
        log.fatal('Unable to login to the bot. Are your intents enabled?');
        process.exit(0);
    }).then(() => {
        log.success('Logged in');
    })
}

client.on('ready', () => {
    client.user.setActivity(config.discord['status'], { type: 'WATCHING' });
});

client.on('interactionCreate', (interaction) => {
    let success = new MessageEmbed()
        .setColor('#0099FF')
        .setTitle('Success')
        .setDescription('You agreed to the rules successfully.');
    
    if (!interaction.isButton()) return;
    if (interaction.isButton('rulesa')) {
        log.info('User agreed to the rules');
        interaction.deferUpdate();

        const user = client.users.cache.get(interaction.user.id);
        user.send('You agreed to the rules successfully.').catch(console.error);

        const linkID = pool.createLink(user.id);

        const embed2 = new MessageEmbed()
            .setTitle('reCaptcha Verification')
            .setDescription(`To gain access to this server, you must prove that you are a human. Please visit the link below to verify yourself.\n\n${config.https ? 'https://' : 'http://'}${config.domain}/verify/${linkID}\nThis link will expire in **15 minutes**.`)
            .setColor('BLUE');
        user.send({ embeds: [ embed2 ] }).catch(() => {
            log.error('Unable to send verification message to user (They may have DMs turned off)');
        });
    }
});

client.on('messageCreate', async (message) => {
    let prefix = config.discord['prefix'];
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    
    const args = message.content.slice(prefix.length).trim().split(' ');
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        return message.channel.send('Pong!');
    }

    if (command === 'verify') {
        if (message.member.roles.cache.has(config.discord['verified_role_id'])) {
            return message.channel.send(`You are already verified.`);
        }

        if (config.discord['rules'] == true) {
            const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('rulesa')
                        .setLabel('Agree')
                        .setStyle('SUCCESS'),
                );
            const embed = new MessageEmbed()
                .setColor('#0099FF')
                .setTitle('Rules')
                .setDescription(config.discord['rules_text'])
                .setFooter('You must agree to the rules to gain access to the server.');
            
            await message.author.send({ content: 'Please agree to the rules listed below.', ephemeral: true, embeds: [ embed ], components: [ row ] });
            message.channel.send('Please check your DMs.');
        } else {
            const linkID = pool.createLink(message.author.id);
            const embed = new MessageEmbed()
                .setTitle('reCaptcha Verification')
                .setDescription(`To gain access to this server, you must prove that you are a human. Please visit the link below to verify yourself.\n\n${config.https ? 'https://' : 'http://'}${config.domain}/verify/${linkID}\nThis link will expire in **15 minutes**.`)
                .setColor('BLUE');
            await message.author.send({ embeds: [ embed ] }).catch(() => {
                log.error('Unable to send verification message to user (They may have DMs turned off)');
            });
            return message.channel.send('Please check your DMs.');
        }
    }
});

client.on('guildMemberAdd', (member) => {
    const linkID = pool.createLink(member.id);
    const embed = new MessageEmbed()
        .setTitle('reCaptcha Verification')
        .setDescription(`To gain access to this server, you must prove that you are a human. Please visit the link below to verify yourself.\n\n${config.https ? 'https://' : 'http://'}${config.domain}/verify/${linkID}\nThis link will expire in **15 minutes**.`)
        .setColor('BLUE');
    
    member.send({ embeds: [ embed ] }).catch(() => {
        log.error('Unable to send verification message to user (They may have DMs turned off)');
    });
});

async function addRole(userID) {
    try {
        const guild = await client.guilds.fetch(config.discord['guild-id']);
        const role = await guild.roles.fetch(config.discord['verified-role-id']);
        const member = await guild.members.fetch(userID);
        member.roles.add(role).catch(() => {
            logger.error(`Failed to add role to user ${member.user.tag}! (Maybe verified role is above bot role?)`);
            return;
        });
        logger.info(`Added verified role to user ${member.user.tag}.`);
    } catch (e) {
        logger.error(`Failed to add role to user ${userID}!`);
    }
}

async function removeRole(userID) {
    const ifremrole = config.discord['remove-role'];
    if (ifremrole == true) {
        try {
            const guild = await client.guilds.fetch(config.discord['guild-id']);
            const remrole = await guild.roles.fetch(config.discord['remove-role-id']);
            const member = await guild.members.fetch(userID);

            member.roles.remove(remrole).catch(() => {
                logger.error(`Failed to remove role to user ${member.user.tag}! (Maybe role is above bot role?)`);
                return;
            });
            logger.info(`Removed role to user ${member.user.tag}.`);
        } catch (e) {
            logger.error(`Failed to add role to user ${userID}!`);
        }
    } else {
        logger.info(`Remove role is set to false, step skipped.`)
    }
}

module.exports = {
    run: main,
    addRole,
    removeRole
}