import { createApp } from '../src/app.js';
import { initDatabase } from '../db/database.js';
import { SettingModel } from '../src/models/setting.model.js';
import { config } from '../config.js';

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      await initDatabase();
      await SettingModel.hydrateConfig(config);
      return createApp();
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
