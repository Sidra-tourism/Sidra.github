/** Minimal QR Code Model 2, version 2, low-error-correction, alphanumeric only.
 * Encodes only the Sidra membership reference (no personal data or remote service).
 * Fixed mask 0 is valid under ISO/IEC 18004; IDs shorter than 47 alphanumeric characters.
 */
const ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const SIZE=25;
const DATA_CODEWORDS=34;
const ECC_CODEWORDS=10;
function mul(a,b){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z&0x80)?0x11d:0);if((b>>>i)&1)z^=a;}return z&255;}
function ecc(data){
  let poly=[1];
  let root=1;
  for(let i=0;i<ECC_CODEWORDS;i++){
    const next=new Array(poly.length+1).fill(0);
    for(let j=0;j<poly.length;j++){next[j]^=poly[j];next[j+1]^=mul(poly[j],root);}
    poly=next;root=mul(root,2);
  }
  const rem=new Array(ECC_CODEWORDS).fill(0);
  for(const byte of data){const factor=byte^rem.shift();rem.push(0);for(let i=0;i<rem.length;i++)rem[i]^=mul(poly[i+1],factor);}
  return rem;
}
export function makeMemberQrCode(value){
  if(typeof value!=='string'||value.length<10||value.length>47||!/^[A-Z0-9-]+$/.test(value))throw new Error('Invalid membership code');
  let bits=[];
  const add=(v,count)=>{for(let i=count-1;i>=0;i--)bits.push((v>>>i)&1);};
  add(0b0010,4);add(value.length,9);
  for(let i=0;i<value.length;i+=2){
    const a=ALPHABET.indexOf(value[i]);if(i+1<value.length)add(a*45+ALPHABET.indexOf(value[i+1]),11);else add(a,6);
  }
  const max=DATA_CODEWORDS*8;
  add(0,Math.min(4,max-bits.length));
  while(bits.length%8)bits.push(0);
  let data=[];
  for(let i=0;i<bits.length;i+=8){let n=0;for(let j=0;j<8;j++)n=n<<1|bits[i+j];data.push(n);}
  while(data.length<DATA_CODEWORDS)data.push(data.length%2?0x11:0xec);
  const words=data.concat(ecc(data));
  const full=words.flatMap(x=>Array.from({length:8},(_,i)=>(x>>>(7-i))&1));
  const modules=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
  const reserved=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
  function set(x,y,dark){if(x<0||y<0||x>=SIZE||y>=SIZE)return;modules[y][x]=!!dark;reserved[y][x]=true;}
  function finder(cx,cy){for(let y=-1;y<=7;y++)for(let x=-1;x<=7;x++){
    const outer=x>=0&&x<=6&&y>=0&&y<=6;
    const black=outer&&(x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4));
    set(cx+x,cy+y,black);
  }}
  finder(0,0);finder(SIZE-7,0);finder(0,SIZE-7);
  for(let i=8;i<SIZE-8;i++){set(i,6,i%2===0);set(6,i,i%2===0);}
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(18+dx,18+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  // Reserve all format information positions so data never overwrites them.
  for(let i=0;i<=8;i++)if(i!==6){set(8,i,false);set(i,8,false);}
  for(let i=0;i<8;i++)set(SIZE-1-i,8,false);
  for(let i=0;i<7;i++)set(8,SIZE-1-i,false);
  set(8,SIZE-8,true);
  let bitPos=0;
  for(let right=SIZE-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<SIZE;vert++){
      const y=(((right+1)&2)===0)?SIZE-1-vert:vert;
      for(let j=0;j<2;j++){
        const x=right-j;
        if(reserved[y][x])continue;
        const bit=bitPos<full.length?full[bitPos]:0;bitPos++;
        modules[y][x]=Boolean(bit^(((x+y)&1)===0?1:0));
      }
    }
  }
  // Error correction level L (binary 01), mask 0, BCH-15 format field.
  const d=(1<<3)|0;
  let rem=d;
  for(let i=0;i<10;i++)rem=(rem<<1)^(((rem>>>9)&1)?0x537:0);
  const format=((d<<10)|rem)^0x5412;
  const get=i=>((format>>>i)&1)===1;
  for(let i=0;i<=5;i++)set(8,i,get(i));
  set(8,7,get(6));set(8,8,get(7));set(7,8,get(8));
  for(let i=9;i<15;i++)set(14-i,8,get(i));
  for(let i=0;i<8;i++)set(SIZE-1-i,8,get(i));
  for(let i=8;i<15;i++)set(8,SIZE-15+i,get(i));
  set(8,SIZE-8,true);
  return modules;
}
export function renderMemberQrCode(root,code){
  const matrix=makeMemberQrCode(code);
  const NS='http://www.w3.org/2000/svg';const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 0 33 33');svg.setAttribute('width','150');svg.setAttribute('height','150');
  svg.setAttribute('role','img');svg.setAttribute('aria-label','Membership QR code for '+code);
  const base=document.createElementNS(NS,'rect');base.setAttribute('width','33');base.setAttribute('height','33');base.setAttribute('fill','#fff');svg.appendChild(base);
  const path=document.createElementNS(NS,'path');let commands=[];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(matrix[y][x])commands.push('M'+(x+4)+' '+(y+4)+'h1v1h-1z');
  path.setAttribute('d',commands.join(''));path.setAttribute('fill','#061b31');svg.appendChild(path);
  root.replaceChildren(svg);
}