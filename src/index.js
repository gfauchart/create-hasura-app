#!/usr/bin/env node

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const commander = require('commander');
const Handlebars = require('handlebars');

const spawn = require('cross-spawn');

function install(dependencies) {
  return new Promise((resolve, reject) => {
    const command = 'npm';
    const args = [
      'install',
      '--no-audit', // https://github.com/facebook/create-react-app/issues/11174
      '--save',
      '--save-exact',
      '--loglevel',
      'error',
    ].concat(dependencies);

    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')}`));
        return;
      }
      resolve();
    });
  });
}

async function run() {
  let projectName;

  const program = new commander.Command()
    .version('1.0.0')
    .arguments('<project-name>')
    .usage(`${chalk.green('<project-name>')} [project-name]`)
    .action((name) => {
      projectName = name;
    })
    .option('--verbose', 'print additional logs')
    .option(
      '--hasura-secret <secret>',
      'specify a hasura secret for the created project',
    )
    .option(
      '--hasura-version <version>',
      'specify a hasura version for the created project',
    )
    .parse(process.argv);

  const cliOptions = program.opts();
  const options = {
    HASURA_SECRET: cliOptions.hasuraSecret,
    HASURA_REMOTE_VERSION: cliOptions.hasuraVersion || '2.0.10',
  };

  const root = path.resolve(projectName);
  const appName = path.basename(root);
  fs.ensureDirSync(projectName);
  console.log(chalk.blue(`Creating project ${projectName}`));


  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true,
    scripts: {
      console: 'hasura console',
    },
  };
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL,
  );

  // create project doler
  process.chdir(root);

  console.log(chalk.blue(`Installing node modules`));
  await install(['hasura-cli@2']);
  console.log(chalk.blue(`Setting up hasura project`));
  const hasuraInitArgs = ['hasura', 'init', '.', '--endpoint', 'http://localhost:8081'];
  if (options.HASURA_SECRET) {
    hasuraInitArgs.push('--admin-secret', options.HASURA_SECRET);
  }
  spawn.sync('npx', hasuraInitArgs);


  console.log(chalk.blue(`Coping template files`));
  const assets = [
    'Dockerfile',
    'docker-compose.yml',
    'metadata/databases/databases.yaml',
  ];
  assets.forEach((asset) => {
    const file = fs.readFileSync(`${__dirname}/../assets/${asset}.handlebars`).toString();
    const template = Handlebars.compile(file)(options);
    fs.writeFileSync(path.join(root, asset), template);
  });
}

run();
