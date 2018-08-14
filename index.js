'use strict';

const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const mime = require('mime-types');
const unzip = require('easy-unzip');

function packageInfo(filePath, aapt = path.join(__dirname, 'bin', os.platform(), 'aapt')) {
  return new Promise(async (resolve, reject) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.apk':
          resolve(await apkInfo(filePath, aapt));
          break;
        case '.xapk':
          resolve(await xapkInfo(filePath));
          break;
        default:
          throw 'Error: Unsupported File Format';
      }
    } catch (error) {
      reject(error);
    }
  });
}

function apkInfo(filePath, aapt) {
  return new Promise(async (resolve, reject) => {
    try {
      const { stdout, stderr } = await execAsync(`"${aapt}" d badging "${filePath}"`);
      if (stderr) throw stderr;
      const pkg = stdout.match(/package: name='(.*?)' versionCode='(.*?)' versionName='(.*?)'/);
      const sdkVer = stdout.match(/sdkVersion:'(.*?)'/);
      const app = stdout.match(/application: label='(.*?)' icon='(.*?)'/);
      const icon = await getIcon(filePath, app[2]);
      resolve({
        name: app[1],
        icon: icon,
        packageName: pkg[1],
        versionCode: Number(pkg[2]),
        versionName: pkg[3],
        requiredSdk: Number(sdkVer[1])
      });
    } catch (error) {
      reject(error);
    }
  });
}

function xapkInfo(filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      const manifest = await getManifest(filePath);
      const icon = await getIcon(filePath);
      resolve({
        name: manifest.name,
        icon: icon,
        packageName: manifest.package_name,
        versionCode: Number(manifest.version_code),
        versionName: manifest.version_name,
        requiredSdk: Number(manifest.min_sdk_version)
      });
    } catch (error) {
      reject(error);
    }
  });
}

function getManifest(filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      resolve(JSON.parse((await unzip(filePath, 'manifest.json')).toString()));
    } catch (error) {
      reject(error);
    }
  });
}

function getIcon(filePath, fileName = 'icon.png') {
  return new Promise(async (resolve, reject) => {
    try {
      const mediaType = mime.lookup(fileName);
      const base64 = (await unzip(filePath, fileName)).toString('base64');
      resolve(`data:${mediaType};base64,${base64}`);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = packageInfo;
