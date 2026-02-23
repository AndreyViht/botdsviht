const db = require('../libs/db');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { safeUpdate } = require('../libs/interactionUtils');

const PETS_CATEGORY_ID = '1475597891388047612';
const PETS_CHANNEL_ID = '1475598451122376704';

const SPECIES = {
  puppy: { label: '🐶 Щенок', emoji: '🐶', breeds: ['Овчарка', 'Лабрадор', 'Хаски', 'Чихуахуа', 'Бульдог', 'Золотистый ретривер', 'Пудель', 'Спаниель', 'Пинчер', 'Шпиц'] },
  cat: { label: '🐱 Кошка', emoji: '🐱', breeds: ['Персидская', 'Сиамская', 'Британская', 'Мейн-кун', 'Рэгдолл', 'Бенгальская', 'Сфинкс', 'Абиссинская', 'Бирманская', 'Девон-рекс'] },
  mouse: { label: '🐭 Мышь', emoji: '🐭', breeds: ['Белая', 'Чёрная', 'Полосатая', 'Пёстрая', 'Альбиносс', 'Голубая', 'Кремовая', 'Шоколадная', 'Серебристая', 'Дамбо'] },
  bird: { label: '🐦 Птица', emoji: '🐦', breeds: ['Волнистый попугайчик', 'Ара', 'Какаду', 'Канарейка', 'Соловей', 'Синица', 'Щегол', 'Снегирь', 'Корелла', 'Амадина'] },
  mammal: { label: '🦊 Млекопитающие', emoji: '🦊', breeds: ['Хомяк', 'Крыса', 'Белка', 'Кролик', 'Енот', 'Ёж', 'Лиса', 'Зайчиха', 'Сурок', 'Бобр'] }
};

const FEEDING_WINDOWS = [
  { name: '🌅 Утро', start: 8, end: 10 },
  { name: '☀️ Обед', start: 12, end: 14 },
  { name: '🌇 Вечер', start: 17, end: 19 }
];

function getColorForSpecies(species) {
  const colors = {
    puppy: 0xD4A574,   // коричневый
    cat: 0xFFA500,     // оранжевый
    mouse: 0x808080,   // серый
    bird: 0x87CEEB,    // небесный
    mammal: 0x8B4513   // седельно-коричневый
  };
  return colors[species] || 0x6a5acd;
}

async function ensurePetManagementMessage(client) {
  try {
    if (!client) return;
    const channel = await client.channels.fetch(PETS_CHANNEL_ID).catch(() => null);
    if (!channel) return console.warn('Pets channel not found:', PETS_CHANNEL_ID);

    const rec = db.getPetManagementMessage();
    const embed = makePetManagementEmbed();
    const rows = makePetManagementRows();

    if (rec && rec.channelId === PETS_CHANNEL_ID && rec.messageId) {
      const existing = await channel.messages.fetch(rec.messageId).catch(() => null);
      if (existing) {
        try {
          await existing.edit({ embeds: [embed], components: rows });
          console.log('Updated existing pet management message');
        } catch (e) {}
        return;
      }
    }

    // Проверить последние сообщения
    const messages = await channel.messages.fetch({ limit: 5 });
    const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('Мои питомцы'));
    
    if (botMsg) {
      console.log('Found existing pet management message via search.');
      try { await botMsg.edit({ embeds: [embed], components: rows }); } catch (e) {}
      await db.setPetManagementMessage(PETS_CHANNEL_ID, botMsg.id);
      return;
    }

    const msg = await channel.send({ embeds: [embed], components: rows }).catch(() => null);
    if (msg) {
      await msg.pin().catch(() => {});
      await db.setPetManagementMessage(PETS_CHANNEL_ID, msg.id);
      console.log('Posted new pet management message to', PETS_CHANNEL_ID);
    }
  } catch (e) { console.error('ensurePetManagementMessage error', e && e.message ? e.message : e); }
}

function makePetManagementEmbed() {
  return new EmbedBuilder()
    .setTitle('🐾 Мои питомцы')
    .setColor(0x9370DB)
    .setDescription(
      'Приветствую! Тут вы можете создать своего питомца.\n\n' +
      '⚠️ **Важные правила:**\n' +
      '• Один пользователь может иметь максимум **3 питомца**.\n' +
      '• Ветка с вашим питомцем видна только вам и администраторам сервера.\n\n' +
      '**Уход за питомцем:**\n' +
      '🍖 **Кормление:** 3 раза в день\n' +
      '   🌅 Утро: 08:00 – 10:00\n' +
      '   ☀️ Обед: 12:00 – 14:00\n' +
      '   🌇 Вечер: 17:00 – 19:00\n\n' +
      '✋ **Гладить:** Минимум 5 раз в день\n' +
      '🛁 **Мыть:** 1 раз в 2 дня\n' +
      '⏱ **Быть рядом:** 1 клик = 2 секунды\n' +
      '🐕 **Выгул:** Обязательно (зависит от вида)\n' +
      '💩 **Уборка:** 2 раза в день\n\n' +
      '🔔 Бот отправит вам уведомления (DM), когда нужно ухаживать за питомцем.'
    )
    .setFooter({ text: 'Нажимайте кнопки ниже для управления питомцами' });
}

function makePetManagementRows() {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('pet_species_select')
        .setPlaceholder('🐾 Выбер вид питомца')
        .addOptions(
          Object.entries(SPECIES).map(([key, { label, emoji }]) => ({
            label: label.replace(emoji + ' ', ''),
            value: key,
            emoji: emoji,
            description: `Создать нового ${label}`
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('my_pets_list')
        .setLabel('📋 Мои питомцы')
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

async function handlePetSpeciesSelect(interaction) {
  try {
    const species = interaction.values[0];
    const breeds = SPECIES[species].breeds;
    
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`pet_breed_select_${species}`)
        .setPlaceholder('🐾 Выбер породу')
        .addOptions(
          breeds.map((breed, idx) => ({
            label: breed,
            value: `${species}_${idx}`,
            description: `Порода ${breed}`
          }))
        )
    );

    await safeUpdate(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`${SPECIES[species].label} — Выбор породы`)
          .setColor(getColorForSpecies(species))
          .setDescription('Выберите породу вашего будущего питомца')
      ],
      components: [row]
    });
  } catch (e) {
    console.error('handlePetSpeciesSelect error', e && e.message ? e.message : e);
    try { await safeUpdate(interaction, { content: 'Ошибка при выборе вида.', components: [] }); } catch (er) {}
  }
}

async function handlePetBreedSelect(interaction) {
  try {
    console.log(`[handlePetBreedSelect] START - deferred: ${interaction.deferred}`);
    
    const [species, breedIdx] = interaction.values[0].split('_');
    console.log(`[handlePetBreedSelect] Species: ${species}, Breed: ${SPECIES[species]?.breeds?.[parseInt(breedIdx)]}`);
    
    if (!SPECIES[species] || !SPECIES[species].breeds[parseInt(breedIdx)]) {
      console.error('[handlePetBreedSelect] Invalid species or breed');
      await interaction.editReply({ content: '❌ Неверный вид или порода.', components: [] });
      return;
    }
    
    // Проверка лимита
    const userPets = db.getUserPets(interaction.user.id);
    if (userPets.length >= 3) {
      console.log('[handlePetBreedSelect] Pet limit reached');
      await interaction.editReply({
        content: '❌ Вы достигли лимита в 3 питомца.',
        components: []
      });
      return;
    }
    
    // Создаём модаль
    const modal = new ModalBuilder()
      .setCustomId(`pet_name_modal_${species}_${breedIdx}`)
      .setTitle(`Создание ${SPECIES[species].label.replace(/[🐶🐱🐭🐦🦊]\s/, '')}`);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('pet_name_input')
          .setLabel('Имя питомца')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Введите имя (макс. 20 символов)')
          .setMaxLength(20)
          .setRequired(true)
      )
    );

    console.log('[handlePetBreedSelect] Calling showModal');
    await interaction.showModal(modal);
    console.log('[handlePetBreedSelect] Modal shown - OK');
    
  } catch (e) {
    console.error('[handlePetBreedSelect] ERROR:', e.message);
    try {
      await interaction.editReply({ 
        content: `❌ Ошибка: ${e.message}`,
        components: []
      }).catch(() => {});
    } catch (er) {
      console.error('[handlePetBreedSelect] editReply failed:', er.message);
    }
  }
}

async function handlePetNameModal(interaction) {
  try {
    const [species, breedIdx] = interaction.customId.replace('pet_name_modal_', '').split('_');
    const name = interaction.fields.getTextInputValue('pet_name_input');
    const breed = SPECIES[species].breeds[parseInt(breedIdx)];
    
    await interaction.deferReply({ ephemeral: true });

    // Создать приватную ветку
    const channel = await interaction.client.channels.fetch(PETS_CHANNEL_ID);
    
    const thread = await channel.threads.create({
      name: `${breed} ${name}`,
      autoArchiveDuration: 10080, // 7 дней
      invitable: false,            // Приватная ветка
      reason: `Pet thread for ${interaction.user.tag}`
    });

    // Добавить владельца в ветку (уже добавлен автоматически)
    // Убедиться, что бот может видеть ветку
    await thread.members.add(interaction.client.user.id);

    // Создать питомца в БД
    const petId = `pet_${interaction.user.id}_${Date.now()}`;
    const pet = await db.addPet(petId, {
      owner_id: interaction.user.id,
      species,
      breed,
      name,
      thread_id: thread.id
    });

    // Отправить embed со статистикой в ветку
    const petEmbed = makePetStatsEmbed(pet);
    const petControls = makePetControlRows(petId);
    await thread.send({ embeds: [petEmbed], components: petControls });

    // Закрепить сообщение
    const messages = await thread.messages.fetch({ limit: 1 });
    const lastMsg = messages.first();
    if (lastMsg) await lastMsg.pin().catch(() => {});

    // Выдать роль владельцу
    await assignPetRole(interaction, breed, species);

    // Ответить
    await interaction.editReply({
      content: `✅ Питомец **${name}** (${breed}) успешно создан! Перейдите в ветку <#${thread.id}> для управления.`,
      ephemeral: true
    });

    console.log(`Pet created: ${petId} - ${name} (${breed}) by ${interaction.user.tag}`);
  } catch (e) {
    console.error('handlePetNameModal error', e && e.message ? e.message : e);
    try {
      await interaction.editReply({
        content: '❌ Ошибка при создании питомца. Пожалуйста, попробуйте ещё раз.',
        ephemeral: true
      });
    } catch (er) {}
  }
}

function makePetStatsEmbed(pet) {
  const now = new Date();
  const ageWeeks = pet.age_weeks || 0;
  const years = Math.floor(ageWeeks / 52);
  const months = Math.floor((ageWeeks % 52) / 4);
  
  return new EmbedBuilder()
    .setTitle(`🐾 ${pet.name} — ${pet.breed}`)
    .setColor(getColorForSpecies(pet.species))
    .setDescription(`Питомец рождён для тебя!\n\n**Информация:**\n• **Возраст:** ${years} лет ${months} месяцев\n• **Статус:** ${pet.status}`)
    .addFields(
      { name: '🍖 Кормление', value: `Последний раз: <t:${Math.floor(pet.stats.lastFed / 1000)}:R>`, inline: true },
      { name: '🛁 Гигиена', value: `Мыт: <t:${Math.floor(pet.stats.lastBathed / 1000)}:R>`, inline: true },
      { name: '✋ Внимание', value: `Поглажено: ${pet.stats.petsCount}/5 сегодня`, inline: true },
      { name: '⏱ Время рядом', value: `${Math.floor(pet.stats.beNearTime / 60)}м сегодня`, inline: true },
      { name: '🐕 Выгул', value: `Гулял: <t:${Math.floor(pet.stats.lastWalked / 1000)}:R>`, inline: true },
      { name: '💩 Уборка', value: `Убрано: <t:${Math.floor(pet.stats.lastCleaned / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: 'Нажимайте кнопки ниже для ухода за питомцем' });
}

function makePetControlRows(petId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pet_feed_${petId}`)
        .setLabel('🍖 Кормить')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pet_pet_${petId}`)
        .setLabel('✋ Гладить')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pet_bath_${petId}`)
        .setLabel('🛁 Мыть')
        .setStyle(ButtonStyle.Info)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pet_nearby_${petId}`)
        .setLabel('⏱ Быть рядом')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pet_walk_${petId}`)
        .setLabel('🐕 Выгул')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pet_clean_${petId}`)
        .setLabel('💩 Уборка')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

async function handlePetButton(interaction) {
  try {
    const [action, petId] = interaction.customId.replace('pet_', '').split('_');
    const pet = db.getPet(petId);

    if (!pet) {
      await interaction.reply({ content: '❌ Питомец не найден.', ephemeral: true });
      return;
    }

    // Проверить права (только владелец)
    if (pet.owner_id !== interaction.user.id) {
      await interaction.reply({ content: '❌ Это не ваш питомец!', ephemeral: true });
      return;
    }

    const now = Date.now();
    let success = false;
    let message = '';

    switch (action) {
      case 'feed':
        const hour = new Date().getHours();
        const canFeed = FEEDING_WINDOWS.some(w => hour >= w.start && hour < w.end);
        if (!canFeed) {
          message = `❌ Питомца нельзя кормить в это время!\n🌅 Утро: 08:00-10:00\n☀️ Обед: 12:00-14:00\n🌇 Вечер: 17:00-19:00`;
        } else {
          await db.updatePetStats(petId, { 'stats.lastFed': now });
          message = `✅ Вы накормили ${pet.name}! 😋`;
          success = true;
        }
        break;

      case 'pet':
        const currentPetsCount = (pet.stats.petsCount || 0) + 1;
        let finalCount = currentPetsCount;
        if (currentPetsCount >= 5) {
          message = `✅ ${pet.name} полностью доволен! 😊 (5/5)`;
          finalCount = 5;
        } else {
          message = `✅ Вы погладили ${pet.name}! (${currentPetsCount}/5)`;
        }
        await db.updatePetStats(petId, { 'stats.petsCount': finalCount });
        success = true;
        break;

      case 'bath':
        const lastBathed = pet.stats.lastBathed || 0;
        const hoursSinceBath = (now - lastBathed) / (1000 * 60 * 60);
        if (hoursSinceBath < 48) {
          message = `❌ ${pet.name} недавно мылся! Следующий раз через ${Math.ceil(48 - hoursSinceBath)} часов.`;
        } else {
          await db.updatePetStats(petId, { 'stats.lastBathed': now });
          message = `✅ Вы помыли ${pet.name}! 🛁`;
          success = true;
        }
        break;

      case 'nearby':
        const currentBeNearTime = (pet.stats.beNearTime || 0) + 2;
        await db.updatePetStats(petId, { 'stats.beNearTime': currentBeNearTime });
        const minutes = Math.floor(currentBeNearTime / 60);
        message = `✅ Вы потратили 2 секунды рядом с ${pet.name}! (${minutes}м всего сегодня)`;
        success = true;
        break;

      case 'walk':
        await db.updatePetStats(petId, { 'stats.lastWalked': now });
        message = `✅ Вы погуляли с ${pet.name}! 🐕`;
        success = true;
        break;

      case 'clean':
        await db.updatePetStats(petId, { 'stats.lastCleaned': now });
        message = `✅ Вы убрали за ${pet.name}! 💩`;
        success = true;
        break;

      default:
        message = '❌ Неизвестное действие.';
    }

    await interaction.reply({ content: message, ephemeral: true });

    // Обновить embed в ветке
    if (success) {
      const updatedPet = db.getPet(petId);
      const thread = await interaction.client.channels.fetch(pet.thread_id);
      const messages = await thread.messages.fetch({ limit: 5 });
      const pinned = messages.find(m => m.pinned);
      if (pinned) {
        await pinned.edit({ embeds: [makePetStatsEmbed(updatedPet)] });
      }
    }
  } catch (e) {
    console.error('handlePetButton error', e && e.message ? e.message : e);
  }
}

async function handleMyPetsList(interaction) {
  try {
    const userPets = db.getUserPets(interaction.user.id);
    
    if (userPets.length === 0) {
      await interaction.reply({
        content: '❌ У вас пока нет питомцев. Создайте первого, используя выпадающий список.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Ваши питомцы')
      .setColor(0x9370DB)
      .setDescription(`У вас **${userPets.length}/3** питомцев`);

    userPets.forEach(pet => {
      const ageWeeks = pet.age_weeks || 0;
      const years = Math.floor(ageWeeks / 52);
      const months = Math.floor((ageWeeks % 52) / 4);
      embed.addField(
        `🐾 ${pet.name} (${pet.breed})`,
        `**Возраст:** ${years}л ${months}м\n**Статус:** ${pet.status}\n**Ветка:** <#${pet.thread_id}>`,
        false
      );
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error('handleMyPetsList error', e && e.message ? e.message : e);
  }
}

async function assignPetRole(interaction, breed, species) {
  try {
    const guild = interaction.guild;
    const roleName = `Питомец: ${breed}`;
    
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      role = await guild.roles.create({
        name: roleName,
        color: getColorForSpecies(species),
        reason: `Auto-created pet role for ${breed}`
      });
    }

    await interaction.member.roles.add(role);
  } catch (e) {
    console.error('assignPetRole error', e && e.message ? e.message : e);
  }
}

module.exports = { 
  ensurePetManagementMessage, 
  handlePetSpeciesSelect, 
  handlePetBreedSelect, 
  handlePetNameModal, 
  handlePetButton,
  handleMyPetsList
};
