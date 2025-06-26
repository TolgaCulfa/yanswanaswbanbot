const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Config
const config = {
  TOKEN: process.env.DISCORD_TOKEN,
  MAIN_GUILD_ID: process.env.MAIN_GUILD_ID, // Ana sunucu ID
  SECONDARY_GUILD_ID: process.env.SECONDARY_GUILD_ID, // Yan sunucu ID
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID, // Log kanalı ID
  EXEMPT_ROLES: process.env.EXEMPT_ROLES?.split(',') || [], // Banlamadan hariç tutulacak roller
  BAN_REASON: 'Yan sunucudan çıkış yaptı' // Varsayılan ban sebebi
};

client.on('ready', () => {
  console.log(`Bot ${client.user.tag} olarak giriş yaptı!`);
});

client.on('guildMemberRemove', async (member) => {
  try {
    // Sadece yan sunucudan çıkanları kontrol et
    if (member.guild.id !== config.SECONDARY_GUILD_ID) return;

    // Hariç tutulan rollerden birine sahip mi kontrol et
    const hasExemptRole = member.roles.cache.some(role => config.EXEMPT_ROLES.includes(role.id));
    if (hasExemptRole) {
      console.log(`${member.user.tag} hariç tutulan role sahip, banlanmadı.`);
      return;
    }

    const mainGuild = client.guilds.cache.get(config.MAIN_GUILD_ID);
    if (!mainGuild) {
      console.error('Ana sunucu bulunamadı!');
      return;
    }

    // Kullanıcıyı ana sunucudan banla
    try {
      await mainGuild.members.ban(member.id, { reason: config.BAN_REASON });
      console.log(`${member.user.tag} (${member.id}) ana sunucudan banlandı.`);

      // Log gönder
      await sendLog(member, config.BAN_REASON);
      
      // Kullanıcıya DM at
      try {
        const dmMessage = `Merhaba ${member.user.username},\n\n` +
                         `${member.guild.name} sunucusundan ayrıldığın için ` +
                         `${mainGuild.name} sunucusundan banlandın.\n\n` +
                         `Eğer bu bir hata olduğunu düşünüyorsan, sunucu yöneticileriyle iletişime geçebilirsin.`;
        
        await member.send(dmMessage);
      } catch (dmError) {
        console.error('DM gönderilemedi:', dmError);
      }

    } catch (banError) {
      console.error('Banlama hatası:', banError);
      await sendLog(member, `Banlama başarısız: ${banError.message}`, true);
    }
  } catch (error) {
    console.error('Genel hata:', error);
  }
});

async function sendLog(member, reason, isError = false) {
  if (!config.LOG_CHANNEL_ID) return;

  try {
    const logChannel = await client.channels.fetch(config.LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(isError ? 0xFF0000 : 0x00FF00)
      .setTitle(isError ? 'Banlama Hatası' : 'Kullanıcı Banlandı')
      .setDescription(`${member.user.tag} (${member.id})`)
      .addFields(
        { name: 'Sebep', value: reason },
        { name: 'Yan Sunucu', value: member.guild.name }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Log gönderilemedi:', error);
  }
}

client.login(config.TOKEN);
