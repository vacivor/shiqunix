// Pure codec for the captured A80 protocol. No device access or implicit retries.
export const REPORT_ID = 4;
export const DATA_LENGTH = 63;
export const MAX_PAYLOAD = 56;

function integer(value, max, label) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new RangeError(label);
}
function report(data) {
  if (!(data instanceof Uint8Array) || data.length !== DATA_LENGTH) throw new RangeError('Expected 63 bytes, excluding Report ID');
}
export function crc16(data) {
  let value = 0xffff;
  for (const byte of data) {
    value ^= byte;
    for (let i=0;i<8;i++) value = value & 1 ? (value >>> 1) ^ 0xa001 : value >>> 1;
  }
  return value;
}
export function buildRequest({command, length=0, offset=0, payload=new Uint8Array(), padding=new Uint8Array()}) {
  integer(command,255,'command'); integer(length,MAX_PAYLOAD,'length'); integer(offset,65535,'offset');
  if (!(payload instanceof Uint8Array) || (payload.length !== 0 && payload.length !== length)) throw new RangeError('Payload must be empty for read requests, or exactly length bytes');
  if (!(padding instanceof Uint8Array) || (padding.length!==0 && padding.length!==MAX_PAYLOAD-length)) throw new RangeError('Padding must fill exactly the unused payload bytes');
  const data = new Uint8Array(DATA_LENGTH);
  data[2]=command;data[3]=length;data[4]=offset&255;data[5]=offset>>>8;
  data.set(payload,7);
  data.set(padding,7+length);
  const sum=data.subarray(2).reduce((a,b)=>a+b,0)&65535;
  data[0]=sum&255;data[1]=sum>>>8;
  return data;
}
export function inspectResponse(request, reportId, data) {
  report(request);report(data);
  if(reportId!==REPORT_ID) return {matched:false,reason:'report-id'};
  if(!request.subarray(2,7).every((v,i)=>v===data[i+2])) return {matched:false,reason:'header'};
  if(data[3]>MAX_PAYLOAD) return {matched:false,reason:'length'};
  const exactEcho=request.every((v,i)=>v===data[i]);
  const requestCrc=crc16(request.subarray(2));
  const prefixMatchesRequestCrc=((data[0]<<8)|data[1])===requestCrc;
  // CRC is of the request, so it cannot certify the integrity of response data.
  return {matched:true,association:'header-only; caller must enforce a single pending request',
    exactEcho,prefixMatchesRequestCrc,
    kind:exactEcho?'echo':prefixMatchesRequestCrc?'request-crc-response':'modified-response',
    payload:data.slice(7,7+data[3])};
}
export function assembleFragments(fragments,totalLength) {
  integer(totalLength,65536,'totalLength');
  const result=new Uint8Array(totalLength), seen=new Uint8Array(totalLength);
  for(const {offset,payload} of fragments) {
    integer(offset,totalLength,'offset');
    if(!(payload instanceof Uint8Array)||offset+payload.length>totalLength) throw new RangeError('Fragment bounds');
    for(let i=0;i<payload.length;i++) {
      if(seen[offset+i]) throw new Error('Overlapping fragments');
      seen[offset+i]=1;result[offset+i]=payload[i];
    }
  }
  if(seen.some(v=>v!==1)) throw new Error('Missing fragments');
  return result;
}
