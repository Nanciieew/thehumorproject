import assert from 'node:assert/strict';
import {test} from 'node:test';
import sharp from 'sharp';
import {captionOverlay,renderFactoryMemes,MEME_TYPE,CaptionLayoutError} from '../lib/factory/render.ts';

async function fixture(width=800,height=600) {
 // A textured original detects re-encoding changes that a flat fill can hide.
 const pixels=Buffer.alloc(width*height*3);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*3;pixels[i]=(x*7+y*3)%256;pixels[i+1]=(x+y*13)%256;pixels[i+2]=(x*3+y*5)%256;
 }
 const bytes=await sharp(pixels,{raw:{width,height,channels:3}}).png().toBuffer();
 return {image:`data:image/png;base64,${bytes.toString('base64')}`,bytes};
}
test('the same original gets the exact same font size, baseline and outline for every caption',async()=>{
 const first=await captionOverlay('NO THANKS',1200,800);
 const second=await captionOverlay('MY BUDGET FILED A RESTRAINING ORDER AGAINST ME',1200,800);
 assert.equal(first.fontSize,second.fontSize);assert.equal(first.lastBaseline,second.lastBaseline);
 assert.equal(first.fontSize,MEME_TYPE.fontSize*0.8);
 assert.ok(first.lastBaseline>800*.9);assert.ok(second.svg.toString().includes('stroke="#000"'));
 assert.ok(second.svg.toString().includes('fill="#fff"'));
 assert.ok(second.svg.toString().includes('<path '));assert.ok(!second.svg.toString().includes('<text'));
});
test('only caption pixels change; native dimensions and the entire remaining image are preserved exactly',async()=>{
 const {image,bytes}=await fixture();
 const [rendered,again]=await renderFactoryMemes(image,['MY BUDGET SAID NO','MY BUDGET SAID NO']);
 assert.deepEqual(rendered,again,'identical inputs produce identical images');
 const original=await sharp(bytes).ensureAlpha().raw().toBuffer();
 const result=await sharp(rendered).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(result.info.width,800);assert.equal(result.info.height,600);
 const overlay=await captionOverlay('MY BUDGET SAID NO',800,600);
 const alpha=await sharp(overlay.svg).ensureAlpha().raw().toBuffer();
 let changed=0;
 for(let pixel=0;pixel<800*600;pixel++){
  const offset=pixel*4;
  if(alpha[offset+3]===0)assert.deepEqual(result.data.subarray(offset,offset+4),original.subarray(offset,offset+4));
  else if(!result.data.subarray(offset,offset+4).equals(original.subarray(offset,offset+4)))changed++;
 }
 assert.ok(changed>100,'caption is actually drawn');
 assert.deepEqual(result.data.subarray(0,800*400*4),original.subarray(0,800*400*4));
});
test('landscape, portrait and small images keep their original sizes',async()=>{
 for(const [width,height] of [[900,300],[300,900],[40,40]]){
  const {image}=await fixture(width,height);const [rendered]=await renderFactoryMemes(image,['NOT TODAY']);
  const metadata=await sharp(rendered).metadata();assert.equal(metadata.width,width);assert.equal(metadata.height,height);
 }
});
test('overlong or unsupported captions are rejected instead of shrinking type or silently substituting fonts',async()=>{
 await assert.rejects(captionOverlay('SOMETHING '.repeat(100),600,600),CaptionLayoutError);
 await assert.rejects(captionOverlay('HELLO 🦄',600,600),CaptionLayoutError);
});
test('EXIF orientation is honoured without cropping or scaling',async()=>{
 const source=await sharp({create:{width:300,height:500,channels:3,background:'#6284ba'}}).jpeg().withMetadata({orientation:6}).toBuffer();
 const [rendered]=await renderFactoryMemes(`data:image/jpeg;base64,${source.toString('base64')}`,['NOT TODAY']);
 const meta=await sharp(rendered).metadata();assert.equal(meta.width,500);assert.equal(meta.height,300);
});
