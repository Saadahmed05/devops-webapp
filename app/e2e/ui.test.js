// Selenium end-to-end UI tests: drive a real browser through the web app like a user would.
//
// Environment variables:
//   APP_URL              app to test (default http://localhost:3000)
//   BROWSER              chrome (default) or MicrosoftEdge
//   HEADLESS=false       show the browser window (for demos)
//   SLOW=true            pause between steps so people can follow along
//   SELENIUM_REMOTE_URL  use a Selenium server/Grid instead of a local browser (used by Jenkins)
//   SCREENSHOT_DIR       save a screenshot after each test
const fs = require('fs');
const path = require('path');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const edge = require('selenium-webdriver/edge');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const BROWSER = process.env.BROWSER || 'chrome';
const HEADLESS = process.env.HEADLESS !== 'false';
const SLOW = process.env.SLOW === 'true';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR;

jest.setTimeout(120000);

let driver;
const taskTitle = `Selenium task ${Date.now()}`;
const pause = () => (SLOW ? driver.sleep(1500) : Promise.resolve());

beforeAll(async () => {
  const args = ['--window-size=1280,900', '--no-sandbox', '--disable-dev-shm-usage'];
  if (HEADLESS) args.push('--headless=new');

  const builder = new Builder()
    .forBrowser(BROWSER)
    .setChromeOptions(new chrome.Options().addArguments(...args))
    .setEdgeOptions(new edge.Options().addArguments(...args));
  if (process.env.SELENIUM_REMOTE_URL) builder.usingServer(process.env.SELENIUM_REMOTE_URL);

  driver = await builder.build();
});

afterEach(async () => {
  if (!SCREENSHOT_DIR || !driver) return;
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const name = expect.getState().currentTestName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}.png`), await driver.takeScreenshot(), 'base64');
});

afterAll(async () => {
  if (driver) await driver.quit();
});

describe('DevOps Web App UI (Selenium)', () => {
  test('home page loads with the correct title and heading', async () => {
    await driver.get(APP_URL);
    await pause();
    expect(await driver.getTitle()).toBe('DevOps Web App');
    expect(await driver.findElement(By.css('h1')).getText()).toBe('Containerized Web App');
  });

  test('deployment info is loaded from the API', async () => {
    const versionCell = await driver.wait(
      until.elementLocated(By.xpath("//table[@id='info']//td[b='version']")),
      10000
    );
    await pause();
    expect(await versionCell.isDisplayed()).toBe(true);
    expect(await driver.findElement(By.id('info')).getText()).toContain('devops-webapp');
  });

  test('user can add a task', async () => {
    await driver.findElement(By.id('title')).sendKeys(taskTitle);
    await pause();
    await driver.findElement(By.css('#form button')).click();

    const item = await driver.wait(
      until.elementLocated(By.xpath(`//ul[@id='tasks']/li[contains(., '${taskTitle}')]`)),
      10000
    );
    await pause();
    expect(await item.getText()).toContain(taskTitle);
  });

  test('user can delete the task', async () => {
    const item = await driver.findElement(By.xpath(`//ul[@id='tasks']/li[contains(., '${taskTitle}')]`));
    await item.findElement(By.css('button')).click();

    await driver.wait(until.stalenessOf(item), 10000);
    await pause();
    const remaining = await driver.findElements(By.xpath(`//ul[@id='tasks']/li[contains(., '${taskTitle}')]`));
    expect(remaining).toHaveLength(0);
  });
});
