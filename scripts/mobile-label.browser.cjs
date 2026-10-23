'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const evidence = path.resolve('test-results/mobile-label');
async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const language of ['ja', 'en']) for (const [width, height] of [[1360,900],[320,568],[393,252]]) {
      const context = await browser.newContext({ viewport: {width,height}, locale: language, reducedMotion:'reduce' });
      const page = await context.newPage();
      const errors=[], requests=[];
      const label=`${language}-${width}x${height}`;
      page.on('pageerror', e=>errors.push(e.message));
      page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
      page.on('request', r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
      try {
        await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
        await page.locator('#langBtn').waitFor();
        if(await page.locator('html').getAttribute('lang')!==language)await page.locator('#langBtn').click();
        const badge=page.locator('.intro [data-i18n="local"]');
        assert.equal(await badge.innerText(),language==='ja'?'完全ローカル処理':'Fully local processing');
        assert.equal(await badge.isVisible(), width > 620, label+': preserve existing mobile badge hiding');
        if(width > 620) assert.ok(await badge.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right+1;}), label+': badge not clipped');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': page width');
        assert.equal(await page.locator('body > footer').isVisible(),width > 760,'Existing footer behavior preserved.');
        if(width!==393) await page.screenshot({path:path.join(evidence,label+'.png')});
        await page.locator('#helpBtn').click();
        const body=page.locator('#helpDlg .dlg-body');
        const build=page.locator('#helpDlg .build');
        assert.equal(await build.isVisible(),width>760,'Preserve existing mobile build hiding');
        if(width>760){await build.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await build.getAttribute('open'),'');}
        await body.evaluate(el=>{el.scrollTop=el.scrollHeight;});
        const helpEnd = await page.locator(width>760?'#depCount':'[data-i18n="importCsvSafetyNote"]').evaluate(el=>{const r=el.getBoundingClientRect(),body=el.closest(".dlg-body").getBoundingClientRect(),dialog=el.closest('dialog').getBoundingClientRect();return {top:r.top,bottom:r.bottom,clipTop:Math.max(0,body.top,dialog.top),clipBottom:Math.min(innerHeight,body.bottom,dialog.bottom)};});
        assert.ok(helpEnd.top>=helpEnd.clipTop-1&&helpEnd.bottom<=helpEnd.clipBottom+1,label+': final Help guidance reachable '+JSON.stringify(helpEnd));
        if(width>760)assert.notEqual(await page.locator('#builtAt').innerText(),'—');
        assert.equal(await page.locator('#helpDlg .dlg-body > :last-child').getAttribute('class'),'build');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#helpDlg').isVisible(),false);
        assert.deepEqual(errors,[],label+': runtime errors');
        assert.deepEqual(requests,[],label+': external requests');
        console.log('PASS '+label);
      } catch(error) {
        await page.screenshot({path:path.join(evidence,'failure-'+label+'.png')}).catch(()=>{});
        throw error;
      } finally {await context.close();}
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
