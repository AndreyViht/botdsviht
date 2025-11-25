const fs = require('fs');
const path = require('path');
const commandsPath = path.join(__dirname, '..', 'bot', 'commands');
const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') && f !== 'register-commands.js');
for (const file of files) {
  try {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.data && typeof cmd.data.toJSON === 'function') {
      console.log(file, JSON.stringify(cmd.data.toJSON(), null, 2));
    } else {
      console.log(file, 'No data.toJSON()');
    }
  } catch (e) {
    console.error('Failed to load', file, e && e.message);
  }
}
