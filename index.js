'use strict';

const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const mime = require('mime-types');
const unzip = require('easy-unzip');
const { parseBuffer: bplistParse } = require('bplist-parser');
const { parse: plistParse } = require('plist');
const { revert: cgbiToPng } = require('cgbi-to-png');

function packageInfo(filePath, aapt = undefined) {
  return new Promise(async (resolve, reject) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.ipa':
          resolve(await ipaInfo(filePath));
          break;
        case '.apk':
          resolve(await apkInfo(filePath, aapt));
          break;
        case '.xapk':
          resolve(await xapkInfo(filePath));
          break;
        default:
          throw new Error('Unsupported File Format');
      }
    } catch (error) {
      reject(error);
    }
  });
}

function ipaInfo(filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      let info = await unzip(filePath, /^Payload\/[^/]+.app\/Info.plist$/);
      if (info.toString('ascii', 0, 6) === 'bplist') {
        info = bplistParse(info)[0];
      } else if (info.toString('ascii', 0, 5) === '<?xml') {
        info = plistParse(info.toString());
      } else {
        throw new Error('Unsupported File Format');
      }
      const icon = await getIcon(
        filePath,
        info.CFBundleIcons &&
          info.CFBundleIcons.CFBundlePrimaryIcon &&
          info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles &&
          info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles.slice(-1)[0]
      );
      resolve({
        icon: icon,
        name: info.CFBundleDisplayName || info.CFBundleName,
        uniqueIdentifier: info.CFBundleIdentifier,
        version: info.CFBundleShortVersionString || info.CFBundleVersion,
        buildNumber: info.CFBundleVersion,
        minOsVersion: info.MinimumOSVersion,
        deviceFamily: [].concat(info.UIDeviceFamily),
        platform: 'ios'
      });
    } catch (error) {
      reject(error);
    }
  });
}

function apkInfo(filePath, aapt = undefined) {
  return new Promise(async (resolve, reject) => {
    try {
      aapt = aapt || path.join(__dirname, 'bin', os.platform(), 'aapt');
      const { stdout, stderr } = await execAsync(`"${aapt}" d badging "${filePath}"`);
      if (stderr) throw stderr;
      const pkg = stdout.match(/package: name='(.*?)' versionCode='(.*?)' versionName='(.*?)'/);
      const sdkVer = stdout.match(/sdkVersion:'(.*?)'/);
      const app = stdout.match(/application: label='(.*?)' icon='(.*?)'/);
      const icon = await getIcon(filePath, app[2]);
      resolve({
        icon: icon,
        name: app[1],
        uniqueIdentifier: pkg[1],
        version: pkg[3],
        buildNumber: pkg[2],
        minOsVersion: sdkVer[1],
        platform: 'android'
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
        icon: icon,
        name: manifest.name,
        uniqueIdentifier: manifest.package_name,
        version: manifest.version_name,
        buildNumber: manifest.version_code,
        minOsVersion: manifest.min_sdk_version,
        platform: 'android'
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

function getIcon(filePath, fileName = undefined) {
  return new Promise(async (resolve, reject) => {
    try {
      let mediaType, base64;
      if (path.extname(filePath).toLowerCase() === '.ipa') {
        fileName = fileName || /^Payload\/[^/]+.app\/Icon.png$/;
        mediaType = 'image/png';
        base64 = cgbiToPng(await unzip(filePath, fileName)).toString('base64');
      } else {
        fileName = fileName || 'icon.png';
        mediaType = mime.lookup(fileName);
        base64 = (await unzip(filePath, fileName)).toString('base64');
      }
      resolve(`data:${mediaType};base64,${base64}`);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = packageInfo;
