import {verifyWorkshopRelease} from '../lib/workshop/release';

const report = verifyWorkshopRelease(process.cwd());
console.log(JSON.stringify(report));
if (!report.ready) process.exitCode = 1;
