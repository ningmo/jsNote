const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb')
const amqp = require("amqplib");
const useProxy = require('puppeteer-page-proxy');
const userAgent = require('user-agents');
const client = new MongoClient('mongodb://root:123456@127.0.0.1:27017');
const database = client.db("test");
const boss = database.collection("boss");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async ()=>{
    const codes = [
        101010100, 101020100,
        101280100, 101280600,
        101210100, 101030100,
        101110100, 101190400,
        101200100, 101230200,
        101250100, 101270100,
        101180100, 101040100
    ];
    const connection = await amqp.connect("amqp://root:123456@127.0.0.1:5672/proxy");
    const channel = await connection.createChannel();
    await channel.prefetch(1);
    await channel.assertQueue("proxy.queue.qzd");
    
    const callback = async(response)=>{
        if(response.url().startsWith('https://www.exp.com/xxx')){
            const r = await response.json();
            console.log(r.code);
            if(r.code==0){
                await boss.insertMany(r.zpData.jobList);
            }
        }
    }
    async function * source(){
        for(let code of hotCityList){
            for(let i = 1;i<11;i++){
                yield `https://www.exp.com/w=${code}`+ (i==1?'':`&page=${i}`);
            }
        }
    }
    let {port,ip} = JSON.parse((await channel.get("proxy.queue.qzd")).content.toString());
    const config = {
        headless: false,
        defaultViewport:{
            width:1280,
            height:768
        },
        ignoreHTTPSErrors:true,
        args:['--no-sandbox', '--disable-setuid-sandbox','--ignore-certificate-errors']
    };
    const browser = await puppeteer.launch(config);
    const page = await browser.newPage();
    await page.setUserAgent((new userAgent()).toString());
    page.on('response',async response=>callback(response).catch(error=>console.log('responseError:',error.message)));
    // await page.setRequestInterception(true);
    for await (const url of source()){
        console.log(url);
        await page.goto(url);
        await new Promise(resolve=>setTimeout(resolve,5000));
    }
})();

async function scrollToBottom(page) {
    const distance = 100; // should be less than or equal to window.innerHeight
    const delay = 100;
    while (await page.evaluate(() => document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight)) {
        await page.evaluate((y) => { document.scrollingElement.scrollBy(0, y); }, distance);
        await sleep(delay);
    }
}
