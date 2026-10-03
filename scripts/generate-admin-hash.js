#!/usr/bin/env node
/* Generates a bcrypt hash for one /shop-orders admin password, to paste into
   the ADMIN_USERS env var in Netlify. Run locally — never paste a plaintext
   password anywhere else.

   Usage:
     cd netlify/functions && npm install   # once, so bcryptjs is present
     node ../../scripts/generate-admin-hash.js
     (type the password when prompted — it won't echo to the terminal)
*/
const readline = require('readline');
const path = require('path');

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const originalWrite = rl._writeToOutput;
    let masked = false;
    rl._writeToOutput = function (str) {
      if (!masked) {
        originalWrite.call(rl, str);
      }
    };
    rl.question(question, (answer) => {
      rl.history = rl.history.slice(1);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    masked = true;
  });
}

async function main() {
  let bcrypt;
  try {
    bcrypt = require(path.join(__dirname, '..', 'netlify', 'functions', 'node_modules', 'bcryptjs'));
  } catch (e) {
    console.error('Could not find bcryptjs. Run `npm install` inside netlify/functions first.');
    process.exit(1);
  }

  const password = await promptHidden('Password to hash: ');
  if (!password) {
    console.error('No password entered.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  console.log('\nHash (paste this into ADMIN_USERS for this user):\n');
  console.log(hash);
}

main();
