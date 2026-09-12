import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRequest,inspectResponse,assembleFragments} from '../src/protocol.mjs';
const fixtures=['a80-init-01','a80-light-01','a80-effects-02','a80-keymap-01'].flatMap(dir=>JSON.parse(readFileSync(new URL(`../docs/${dir}/transactions.json`,import.meta.url))).transactions);
const bytes=hex=>Uint8Array.from(hex.split(' ').map(x=>parseInt(x,16)));

test('reproduce all 136 captured requests, including lighting and keymap writes',()=>{
  for(const tx of fixtures){
    const wire=bytes(tx.requestHex), data=wire.slice(1);
    assert.deepEqual(buildRequest({command:tx.command,length:tx.length,offset:tx.offset,payload:data.slice(7,7+tx.length),padding:data.slice(7+tx.length)}),data);
  }
});
test('responses retain request CRC semantics, including changed data',()=>{
  const tx=fixtures.find(t=>t.command===3);
  const decoded=inspectResponse(bytes(tx.requestHex).slice(1),4,bytes(tx.response.dataHex).slice(1));
  assert.equal(decoded.kind,'request-crc-response');assert.equal(decoded.exactEcho,false);
  assert.equal(decoded.payload.length,34);
});
test('report ID, header and truncated data cannot be silently accepted',()=>{
  const tx=fixtures.find(t=>t.command===7), req=bytes(tx.requestHex).slice(1), rx=bytes(tx.response.dataHex).slice(1);
  assert.equal(inspectResponse(req,3,rx).matched,false);
  const unrelated=rx.slice();unrelated[4]=56;assert.equal(inspectResponse(req,4,unrelated).matched,false);
  assert.throws(()=>inspectResponse(req,4,rx.slice(0,32)));
});
test('reassemble real keymap and reject missing and overlapping pieces',()=>{
  const fragments=fixtures.slice(0,15).filter(t=>t.command===7).map(t=>({offset:t.offset,payload:bytes(t.response.payloadHex)}));
  assert.deepEqual(assembleFragments(fragments,273),new Uint8Array(readFileSync(new URL('../docs/a80-init-01/command-07.bin',import.meta.url))));
  assert.throws(()=>assembleFragments(fragments.slice(1),273));
  assert.throws(()=>assembleFragments([...fragments,fragments[0]],273));
});
test('invalid request parameters never silently truncate',()=>{
  assert.throws(()=>buildRequest({command:256}));assert.throws(()=>buildRequest({command:7,length:57}));
  assert.throws(()=>buildRequest({command:6,length:26,payload:new Uint8Array(1)}));
});
