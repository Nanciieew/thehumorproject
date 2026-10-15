import assert from 'node:assert/strict';
import {test} from 'node:test';
import {signReceipt,verifyReceipt} from '../lib/roast/receipt.ts';
import {returnPath} from '../lib/auth/return-path.ts';
process.env.SUPABASE_SECRET_KEY='fixture-signing-key';
test('receipt binds the exact snapshot, owner, caption and expiry',()=>{
 const token=signReceipt('alice','A verified caption','YWJj');
 assert.equal(verifyReceipt(token,'alice','YWJj'),'A verified caption');
 assert.throws(()=>verifyReceipt(token,'bob','YWJj'));
 assert.throws(()=>verifyReceipt(token,'alice','YWJk'));
 assert.throws(()=>verifyReceipt(token+'x','alice','YWJj'));
 const now=Date.now;Date.now=()=>now()+16*60000;
 try{assert.throws(()=>verifyReceipt(token,'alice','YWJj'));}finally{Date.now=now;}
});
test('login return paths cannot redirect to external destinations',()=>{
 for(const bad of ['https://evil.test','//evil.test','/\\evil.test','/\nnext'])assert.equal(returnPath(bad),'/');
 assert.equal(returnPath('/challenges/123'),'/challenges/123');
});
