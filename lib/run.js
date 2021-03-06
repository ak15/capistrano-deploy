"use strict";

// took some code from https://github.com/Azure/k8s-actions
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
    function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};


// no idea what this does
Object.defineProperty(exports, "__esModule", { value: true });

const core = require("@actions/core");
const io = require("@actions/io");
const toolrunner = require("@actions/exec/lib/toolrunner");
const fs = require('fs');

function install_deps() {
  return __awaiter(this, void 0, void 0, function* () {
    let runner = null;
    runner = new toolrunner.ToolRunner('gem', ['install', 'bundler:1.17.3', '--no-document']);
    yield runner.exec();

    let runner2 = null;
    runner2 = new toolrunner.ToolRunner('bundle', ['install', '--deployment', '--jobs=4', '--without=production test']);
    yield runner2.exec();
  });
}

function decrypt_key(deploy_key, enc_rsa_key_pth) {
  return __awaiter(this, void 0, void 0, function* () {
    // Create directory if it doesn't yet exists
    yield io.mkdirP('config');

    const runner0 = new toolrunner.ToolRunner('openssl', ['version']);
    yield runner0.exec();

    const runner = new toolrunner.ToolRunner('openssl',
        ['enc', '-d', '-aes-256-cbc', '-md', 'sha512', '-salt', '-in',
         enc_rsa_key_pth, '-out', 'config/deploy_id_rsa', '-k', deploy_key, '-a']);
    yield runner.exec();

    const runner1 = new toolrunner.ToolRunner('chmod', ['0600', 'config/deploy_id_rsa']);
    yield runner1.exec();

    const authSock = '/tmp/ssh-auth.sock'
    const runner2 = new toolrunner.ToolRunner('ssh-agent', ['-a', authSock]);
    yield runner2.exec();

    core.exportVariable('SSH_AUTH_SOCK', authSock);
    const runner3 = new toolrunner.ToolRunner('ssh-add', ['config/deploy_id_rsa']);
    yield runner3.exec();
  });
}

function deploy(target, cap_path) {
  return __awaiter(this, void 0, void 0, function* () {
    let args = [];

    let options = {
      cwd: cap_path
    }

    if (!target) {
      args = ['exec', 'cap', 'deploy'];
    } else {
      args = ['exec', 'cap', target, 'deploy'];
    }
    let runner = new toolrunner.ToolRunner('bundle', args, options);
    yield runner.exec();
  });
}

function run() {
  return __awaiter(this, void 0, void 0, function* () {
    let target = core.getInput('target');
    let cap_path = core.getInput('cap_path');
    let deploy_key = core.getInput('deploy_key');
    let enc_rsa_key_pth = core.getInput('enc_rsa_key_pth');

    if (!deploy_key) {
      core.setFailed('No deploy key given');
    }

    try {
      if (!fs.existsSync(enc_rsa_key_pth)) {
        core.setFailed('Encrypted RSA private key file or value does not exist.');
      }
    } catch(error) {
      core.setFailed(error);
    }

    yield install_deps();
    yield decrypt_key(deploy_key, enc_rsa_key_pth);
    yield deploy(target, cap_path);
  });
}

run().catch(core.setFailed);
