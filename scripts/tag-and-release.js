const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');
const util = require('util');

//const NAMESPACE = 'cima';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = util.promisify(rl.question).bind(rl);

function executeCommand(command, message) {
  /**
   * Execute a command and exit printing a message
   * if the command fails
   * */
  console.log('execute: ', command);
  try {
    execSync(command);
  } catch (e) {
    console.error(message);
    console.error(e);
    process.exit(1);
  }
}


function updatePackageJSON(projectName, newVersion) {
  /**
   * update version number in package.json file
   * */
  const packageLocation = `./projects/${projectName}/package.json`;
  try {
    const text = fs.readFileSync(packageLocation, { encoding: 'utf-8' });
    const packageJson = JSON.parse(text);
    packageJson.version = newVersion;

    fs.writeFileSync(packageLocation, JSON.stringify(packageJson, null, 2));
    command = `git add ${packageLocation}`;
    executeCommand(command, `Error: Could not add ${packageLocation} to Git.`);

  } catch (e) {
    console.error(`Error: could not read ${packageLocation}`);
    process.exit(1);

  }
}

function updateConfigTS(projectName, newVersion) {
  /**
   * update version number in config.ts file
   *
   * */
  const configLocation = `./projects/${projectName}/src/lib/${projectName}.config.ts`;
  // read file content
  const text = fs.readFileSync(configLocation, { encoding: 'utf-8' });
  // replace version number
  const newText = text
    .replace(/version: '.*'/, `version: '${newVersion}'`)
    .replace(/version: ".*"/, `version: "${newVersion}"`);
  // write new content to file
  fs.writeFileSync(configLocation, newText);

  command = `git add ${configLocation}`;
  executeCommand(command, `Error: Could not add ${configLocation} to Git.`);
}


async function main() {
  // first check if the current branch is main
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

  // check if there are any uncommitted changes
  const uncommittedChanges = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();

  if (uncommittedChanges) {
    console.error('Error: There are uncommitted changes.');
    console.log(uncommittedChanges);
    process.exit(1);
  }

  // Check if the current branch is "main"
  if (currentBranch !== 'main') {
    const answer = await question(`Current branch is '${currentBranch}'. Do you want to continue? (y/N) `);
    if (answer !== 'y') {
      process.exit(1);
    }
  }
  // get latest changes from remote
  execSync('git fetch')

  // check if current branch is behind remote or has diverged
  const commitsToPull = execSync(`git log HEAD..origin/${currentBranch} --oneline`, { encoding: 'utf-8' }).trim();
  if (commitsToPull) {
    console.log('There are commits to pull:');
    console.log(commitsToPull);
    console.log('Please update your local branch. Aborting.')
    process.exit(1);
  }


  // get latest git tags
  const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();

  // check if current commit hash is different from latest tag hash
  const currentCommitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  const tagCommitHash = execSync(`git rev-list -n 1 ${tag}`, { encoding: 'utf-8' }).trim();

  if (currentCommitHash == tagCommitHash) {
    console.error('Nothing to release. Current commit hash is the same as the latest tag hash.');
    process.exit(0);
  }

  // extract version number from tag
  let currentVersion = tag.replace('v', '');
  // extract major, minor and patch numbers
  const [major, minor, patch] = currentVersion.split('.');
  // create a new version number by incrementing the patch number
  let newVersion = `${major}.${minor}.${parseInt(patch) + 1}`;

  let answer;
  while (answer !== 'y') {
    answer = await question(`${currentVersion} -> ${newVersion}: OK? (y/N)`);
    if (answer !== 'y') {
      const maybeNewVersion = await question(`Insert new version number (e.g. ${newVersion}): `);
      if (/^\d+\.\d+\.\d+$/.test(maybeNewVersion)) {
        newVersion = maybeNewVersion;
      } else {
        console.error('Error: Invalid version number.');
      }
    }
  }


  let command;
  // cycle all projects in 'projects' folder
  const projects = fs.readdirSync(`./projects/`);
  for (const projectName of projects) {
    // check if the project is a directory
    const projectLocation = `./projects/${projectName}`;
    const stats = fs.statSync(projectLocation);
    if (!stats.isDirectory()) {
      continue;
    }

    console.log('Processing project: ', projectName);
    updatePackageJSON(projectName, newVersion);

    try {
      updateConfigTS(projectName, newVersion);
    } catch (e) {
      console.warn('Warning: could not update config.ts file');
      console.warn(e);
    }
  }

  // review changes
  console.log('\n---------- CHANGES -------------');
  command = `git status`
  execSync(command, { stdio: 'inherit' });
  // ask for confirmation
  console.log('---------------------------');
  answer = await question(`Proceed? (y/N) `);
  if (answer !== 'y') {
    console.log('Aborted.')
    process.exit(0);
  }

  command = `git commit -m "Bump to v${newVersion}"`
  executeCommand(command, 'Error: Could not commit changes to Git.');

  // create tag for new version
  command = `git tag v${newVersion}`
  executeCommand(command, `Error: Could not create tag v${newVersion} .`);

  // Push tag to remote
  command = `git push origin v${newVersion}`
  executeCommand(command, `Error: Could not push tag v${newVersion} to remote.`);

  // Push changes to branch
  command = `git push`
  executeCommand(command, `Error: Could not push changes to remote.`);

  rl.close();
  process.exit(0);
}

main();
