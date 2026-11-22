const SB=supabase.createClient('https://ynchtzndogltyziitrqv.supabase.co','sb_publishable_30G6TknbWIajO8ewUpkAaw_DiRbErX1');
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp=n=>'Rp'+Number(n||0).toLocaleString('id-ID');
let me=null,prof=null,cats=[],prods=[],orders=[],sellers={},uinfo={},authMode=null,chatTo=null,chatT=null,banners=[],perms=['cat','item','mine'],users=[],tab='home',cat=null,q='';

function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3000)}
function modal(h){$('#sheet').innerHTML='<button class="x" onclick="closeM()" aria-label="Tutup">×</button>'+h;$('#modal').classList.add('show')}
function closeM(){$('#modal').classList.remove('show')}
function go(t){tab=t;render();scrollTo(0,0)}

async function setUser(u){
  me=u||null;prof=null;
  if(me){const{data}=await SB.from('profiles').select('*').eq('id',me.id).single();prof=data}
  refreshNotif();refreshChatBadge();
}
async function load(){
  const[c,p,b,si,pm]=await Promise.all([
    SB.from('categories').select('*').order('name'),
    SB.from('products').select('*').eq('active',true).order('sold_count',{ascending:false}),
    SB.from('banners').select('*').eq('active',true).order('sort').order('id'),
    SB.from('seller_info').select('*'),
    SB.from('settings').select('value').eq('key','seller_perms').maybeSingle()
  ]);
  if(c.error||p.error)toast('Gagal memuat data');
  cats=c.data||[];prods=p.data||[];banners=b.data||[];
  sellers=Object.fromEntries((si.data||[]).map(x=>[x.id,x]));
  try{const v=JSON.parse(pm.data?.value);if(Array.isArray(v))perms=v}catch(e){}
}
async function init(){
  const{data:{session}}=await SB.auth.getSession();
  await setUser(session?.user);await load();render();
}
async function render(){
  clearInterval(chatT);closeM();
  document.body.classList.toggle('inchat',tab=='chat'&&!!chatTo);
  const sb=$('#sbtn');if(sb)sb.style.display=tab=='home'?'':'none';
  if(tab!='home')$('#sp').classList.remove('open');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t==tab));
  $('#main').innerHTML=await({home,chat:chatV,transaksi:trx,akun}[tab])();
}

const sec=(t,h)=>`<h4>${t}</h4>${h}`;
const kids=id=>cats.filter(c=>c.parent_id==id);
const within=id=>[id,...kids(id).flatMap(c=>within(c.id))];
const path=c=>c.parent_id?path(cats.find(x=>x.id==c.parent_id)||{name:'?'})+' › '+c.name:c.name;
function disc(p){return p.discount_percent||0}
const fp=p=>Math.round(p.price*(100-disc(p))/100);
const priceH=p=>disc(p)?`<span class="pr">${rp(fp(p))}</span> <small style="display:inline"><s>${rp(p.price)}</s> −${disc(p)}%</small>`:`<span class="pr">${rp(p.price)}</span>`;
const card=p=>`<div class="card" onclick="openP(${p.id})"><img src="${esc(p.image_url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div class="n">${esc(p.name)}</div><div>${priceH(p)}</div><small>Terjual ${p.sold_count||0}</small></div>`;
const empty=t=>`<p class="mut">${t}</p>`;

function bannerH(){
  if(!banners.length)return `<div class="banner"><b>Tiket emas minggu ini</b><span>Diskon dan event terbaru tampil di sini.</span></div>`;
  return `<div class="bn">${banners.map(b=>`<img src="${esc(b.image_url)}" alt="Banner promo">`).join('')}</div>`;
}
function home(){
  const k=q.toLowerCase(),ids=cat?within(cat):null,cur=cats.find(c=>c.id==cat);
  const list=prods.filter(p=>(!ids||ids.includes(p.category_id))&&(!k||p.name.toLowerCase().includes(k)));
  const cl=k?cats.filter(c=>c.name.toLowerCase().includes(k)):kids(cat);
  let h=bannerH();
  if(cur)h+=`<button class="btn alt" onclick="cat=${cur.parent_id||'null'};render()">‹ Kembali dari ${esc(cur.name)}</button>`;
  if(cat||k)h+=sec(cur?esc(cur.name):'Hasil pencarian',`<div class="grid">${list.map(card).join('')||empty('Item tidak ditemukan.')}</div>`);
  else h+=sec('Top Seller',`<div class="scroll">${prods.slice(0,8).map(card).join('')||empty('Belum ada item. Seller bisa menambah item di tab Akun.')}</div>`);
  h+=sec(cur?'Sub-kategori':'Kategori',`<div class="cats">${cl.map(c=>`<button class="cat" onclick="cat=${c.id};q='';$('#q').value='';render()">${c.image_url?`<img src="${esc(c.image_url)}" alt="" loading="lazy">`:''}${esc(c.name)}</button>`).join('')||empty(cur?'Tidak ada sub-kategori.':'Belum ada kategori.')}</div>`);
  return h;
}

function openP(id){
  const p=prods.find(x=>x.id==id),sl=sellers[p.seller_id];
  modal(`<img src="${esc(p.image_url)}" alt="" onerror="this.remove()"><h3>${esc(p.name)}</h3><p>${priceH(p)}</p><small>Stok ${p.stock}</small>${p.description?`<p style="margin:10px 0">${esc(p.description)}</p>`:''}${p.seller_id?`<div class="who sel">${av(sl)}<div><b>${esc(sl?.name||'Penjual')}</b><small>Penjual</small></div></div>`:''}<button class="btn" onclick="buy(${p.id})">Beli sekarang</button>${p.seller_id&&p.seller_id!=me?.id?`<button class="btn alt" onclick="openChat('${p.seller_id}')">Chat penjual</button>`:''}`+manage(p));
}
async function buy(id){
  if(!me){closeM();toast('Masuk dulu di tab Akun');return go('akun')}
  const p=prods.find(x=>x.id==id);
  if(p.stock<1)return toast('Stok habis');
  const{data,error}=await SB.from('orders').insert({buyer_id:me.id,seller_id:p.seller_id,product_id:p.id,amount:fp(p)}).select().single();
  if(error)return toast(error.message);
  toast('Pesanan dibuat');payPop(p,data);
}

const ST={pending:'Menunggu pembayaran',paid:'Menunggu dikirim',shipped:'Sudah terkirim',done:'Selesai'};
let tf='all';
async function trx(){
  if(!me)return auth('Masuk untuk melihat transaksi.');
  const{data}=await SB.from('orders').select('*,products(name,image_url,sold_count,payment_qr_url)').order('created_at',{ascending:false});
  orders=data||[];
  const l=orders.filter(o=>tf=='all'||o.status==tf);
  const chips=[['all','Semua'],...Object.entries(ST)].map(([k,v])=>`<button class="chip ${tf==k?'on':''}" onclick="tf='${k}';render()">${v}</button>`).join('');
  return `<div class="chips">${chips}</div>`+(l.map(o=>`<div class="row" onclick="openO(${o.id})"><img src="${esc(o.products?.image_url)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(o.products?.name||'Item dihapus')}</b><small>${rp(o.amount)} · ${ST[o.status]||esc(o.status)} · ${o.buyer_id==me.id?'Beli':'Jual'}</small></div></div>`).join('')||empty('Belum ada transaksi di status ini.'));
}
function openO(id){
  const o=orders.find(x=>x.id==id),ad=prof?.role=='admin';
  let b='';
  if(o.buyer_id==me.id&&o.status=='pending')b+=`<button class="btn" onclick="payPop({payment_qr_url:orders.find(x=>x.id==${o.id}).products?.payment_qr_url,seller_id:'${o.seller_id}'},orders.find(x=>x.id==${o.id}))">Lihat QR pembayaran</button>`;
  if(ad&&o.status=='pending')b+=`<button class="btn alt" onclick="confirmO(${o.id})">Konfirmasi pembayaran</button>`;
  if((o.seller_id==me.id||ad)&&o.status=='paid')b+=`<button class="btn" onclick="setSt(${o.id},'shipped')">Tandai sudah dikirim</button>`;
  if((o.buyer_id==me.id||ad)&&o.status=='shipped')b+=`<button class="btn" onclick="setSt(${o.id},'done')">Pesanan diterima</button>`;
  modal(`<h3>Detail transaksi</h3><p>${esc(o.products?.name||'Item dihapus')}</p><p class="pr">${rp(o.amount)}</p><small>${ST[o.status]||esc(o.status)} · ${new Date(o.created_at).toLocaleString('id-ID')}</small>`+b);
}
async function setSt(id,st){
  const{error}=await SB.from('orders').update({status:st}).eq('id',id);
  if(error)return toast(error.message);
  toast('Status diperbarui');render();
}
async function confirmO(id){
  const{error}=await SB.rpc('confirm_order',{oid:id});
  if(error)return toast(error.message);
  closeM();await load();await setUser(me);toast('Pembayaran dikonfirmasi');render();
}
async function coin(uid,n,note){
  const{data:u}=await SB.from('profiles').select('coins').eq('id',uid).single();
  await SB.from('profiles').update({coins:(u?.coins||0)+n}).eq('id',uid);
  await SB.from('coin_log').insert({user_id:uid,change:n,note});
}

function auth(msg){
  if(!authMode)return `<h3>Selamat datang</h3><small>${msg||'Masuk atau daftar untuk mulai belanja.'}</small><button class="btn" onclick="authMode='masuk';render()">Masuk</button><button class="btn alt" onclick="authMode='daftar';render()">Daftar</button>`;
  const d=authMode=='daftar';
  return `<h3>${d?'Daftar':'Masuk'}</h3>${d?'<input id="nm" placeholder="Nama" autocomplete="name">':''}<input id="em" type="email" placeholder="Email" autocomplete="email"><div class="pw"><input id="pw" type="password" placeholder="Password" autocomplete="${d?'new-password':'current-password'}"><button type="button" onclick="togglePw(this)">Lihat</button></div><button class="btn" onclick="${d?'signup':'login'}()">${d?'Daftar':'Masuk'}</button><button class="btn alt" onclick="authMode=null;render()">Kembali</button>`;
}
function togglePw(b){const i=$('#pw'),h=i.type=='password';i.type=h?'text':'password';b.textContent=h?'Sembunyi':'Lihat'}
async function login(){
  const{error}=await SB.auth.signInWithPassword({email:$('#em').value.trim(),password:$('#pw').value});
  if(error)return toast(error.message);
  const{data:{session}}=await SB.auth.getSession();authMode=null;await setUser(session.user);await load();render();
}
async function signup(){
  const name=$('#nm').value.trim();
  if(!name)return toast('Nama wajib diisi');
  const{data,error}=await SB.auth.signUp({email:$('#em').value.trim(),password:$('#pw').value,options:{data:{name}}});
  if(error)return toast(error.message);
  if(!data.session)return toast('Cek email untuk konfirmasi, lalu masuk.');
  authMode=null;await setUser(data.session.user);await load();render();
}
async function logout(){await SB.auth.signOut();await setUser(null);render()}

const av=u=>u?.avatar_url?`<img class="av" src="${esc(u.avatar_url)}" alt="">`:`<div class="av">${esc((u?.name||'?').slice(0,1).toUpperCase())}</div>`;
async function saveName(){
  const v=$('#pnm').value.trim();if(!v)return toast('Nama wajib diisi');
  const{error}=await SB.from('profiles').update({name:v}).eq('id',me.id);
  if(error)return toast(error.message);
  await setUser(me);toast('Nama disimpan');render();
}
async function upAvatar(el){
  const f=el.files[0];if(!f)return;
  if(f.size>5*1024*1024)return toast('Ukuran gambar maksimal 5 MB');
  toast('Mengunggah foto...');
  const pt='avatars/'+me.id+'/'+Date.now()+'.'+(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const{error}=await SB.storage.from('images').upload(pt,f,{contentType:f.type});
  if(error)return toast(error.message);
  const url=SB.storage.from('images').getPublicUrl(pt).data.publicUrl;
  const r=await SB.from('profiles').update({avatar_url:url}).eq('id',me.id);
  if(r.error)return toast(r.error.message);
  await setUser(me);toast('Foto profil diperbarui');render();
}
const FEATS=[['cat','Tambah kategori','Buat kategori baru'],['item','Tambah item','Jual item baru'],['mine','Item saya','Ubah atau hapus item'],['cats','Kelola kategori','Ubah nama, gambar, hapus'],['banner','Banner','Promo di beranda']];
const permBox=()=>`<h3>Atur peran seller</h3><small>Centang fitur yang boleh dipakai seller di panel mereka. Admin selalu punya semua fitur.</small>`+FEATS.map(([k,t,d])=>`<label class="chk"><input type="checkbox" id="pm${k}" ${perms.includes(k)?'checked':''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')+`<button class="btn" onclick="savePerms()">Simpan</button>`;
async function savePerms(){
  const v=FEATS.map(f=>f[0]).filter(k=>document.getElementById('pm'+k).checked);
  const{error}=await SB.from('settings').upsert({key:'seller_perms',value:JSON.stringify(v)});
  if(error)return toast(error.message);
  perms=v;toast('Pengaturan seller disimpan');render();
}
const tile=(k,t,d)=>`<button class="tile" onclick="openBox('${k}')"><b>${t}</b><small>${d}</small></button>`;
const PEN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.828 2.828 0 1 0-4-4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg>';
function editName(){modal(`<h3>Ubah nama</h3><input id="pnm" value="${esc(prof?.name||'')}" placeholder="Nama"><button class="btn" onclick="saveName()">Simpan</button>`)}
function chatAdmin(){
  const a=Object.values(sellers).find(x=>x.role=='admin');
  if(!a)return toast('Admin belum tersedia');
  chatTo={b:me.id,s:a.id};go('chat');
}
async function openBox(k){
  const f={cat:catForm,item:itemForm,mine,disc:discBox,cats:catsBox,banner:bannerBox,users:usersBox,perm:permBox}[k];
  modal(await f());
}
async function akun(){
  if(!me)return auth();
  const r=prof?.role||'buyer';
  let h=`<div class="who"><label class="avl" aria-label="Ganti foto profil">${av(prof)}<input type="file" accept="image/*" onchange="upAvatar(this)" hidden></label><div><div class="nm"><h3>${esc(prof?.name||'Pengguna')}</h3><button class="ic" onclick="editName()" aria-label="Ubah nama">${PEN}</button></div><small>${esc(me.email)} · ${esc(r)}</small></div></div>`;
  if(r!='buyer')h+=`<div class="wallet"><small>Dompetku</small><b>${rp(prof?.coins)}</b></div><h4>Penjualan</h4><div class="tiles">${FEATS.filter(f=>r=='admin'||perms.includes(f[0])).map(f=>tile(...f)).join('')}</div>`;
  if(r=='admin')h+=`<h4>Admin</h4><div class="tiles">${tile('users','Pengguna','Peran, koin, akun')}${tile('perm','Atur peran seller','Pilih fitur seller')}</div>`;
  h+=`<h4>Bantuan</h4>`+(r!='admin'?`<div class="row" onclick="chatAdmin()"><div><b>Chat admin</b><small>Tanya atau laporkan masalah</small></div></div>`:'')+`<button class="btn alt" onclick="logout()">Keluar</button>`;
  return h;
}
const catForm=()=>`<h3>Tambah kategori</h3><input id="cn" placeholder="Nama kategori atau game"><select id="cp"><option value="">Kategori utama (tanpa induk)</option>${cats.map(c=>`<option value="${c.id}">Di dalam ${esc(path(c))}</option>`).join('')}</select><label class="btn alt">Pilih gambar kategori<input type="file" accept="image/*" onchange="upImg(this,'ci')" hidden></label><input id="ci" placeholder="Link gambar (terisi otomatis)"><button class="btn" onclick="addCat()">Tambah kategori</button>`;
const itemForm=()=>`<h3>Tambah item</h3><select id="pc">${cats.map(c=>`<option value="${c.id}">${esc(path(c))}</option>`).join('')}</select><input id="pn" placeholder="Nama item"><input id="pd" placeholder="Deskripsi item"><input id="pp" type="number" placeholder="Harga (Rp)"><input id="ps" type="number" placeholder="Stok"><label class="btn alt">Pilih foto dari galeri<input id="pf" type="file" accept="image/*" onchange="upImg(this,'pi')" hidden></label><input id="pi" placeholder="Link gambar (terisi otomatis)"><label class="btn alt">Pilih gambar QR pembayaran<input type="file" accept="image/*" onchange="upImg(this,'pq')" hidden></label><input id="pq" placeholder="Link QR pembayaran (terisi otomatis)"><button class="btn" onclick="addProd()">Simpan item</button>`;
async function upImg(el,target){
  const f=el.files[0];if(!f)return;
  if(f.size>5*1024*1024)return toast('Ukuran gambar maksimal 5 MB');
  toast('Mengunggah gambar...');
  const ext=(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=me.id+'/'+Date.now()+'.'+ext;
  const{error}=await SB.storage.from('images').upload(path,f,{contentType:f.type});
  if(error)return toast(error.message);
  $('#'+target).value=SB.storage.from('images').getPublicUrl(path).data.publicUrl;
  toast('Gambar terunggah. Lanjut simpan item.');
}
const RED='background:#b3261e;color:#fff';
const manage=p=>(prof&&prof.role!='buyer'&&(prof.role=='admin'||p.seller_id==me?.id))?`<h4>Atur item</h4><input id="en" value="${esc(p.name)}" placeholder="Nama item"><input id="ep" type="number" value="${p.price}" placeholder="Harga"><input id="es" type="number" value="${p.stock}" placeholder="Stok"><input id="edd" value="${esc(p.description||'')}" placeholder="Deskripsi"><label class="btn alt">Ganti foto<input id="ef" type="file" accept="image/*" onchange="upImg(this,'ei')" hidden></label><input id="ei" value="${esc(p.image_url)}" placeholder="Link gambar"><label class="btn alt">Ganti QR pembayaran<input type="file" accept="image/*" onchange="upImg(this,'eq')" hidden></label><input id="eq" value="${esc(p.payment_qr_url||'')}" placeholder="Link QR pembayaran"><input id="ed" type="number" min="0" max="100" value="${p.discount_percent||0}" placeholder="Diskon item (%)"><button class="btn alt" onclick="editProd(${p.id})">Simpan perubahan</button><button class="btn" style="${RED}" onclick="delProd(${p.id})">Hapus item</button>`:'';
const mine=()=>{
  const l=prods.filter(p=>p.seller_id==me.id);
  return `<h3>Item saya</h3><br>`+(l.map(p=>`<div class="uc"><div class="who" onclick="openP(${p.id})" style="cursor:pointer"><img class="av" style="border-radius:10px" src="${esc(p.image_url)}" alt="" onerror="this.style.visibility='hidden'"><div style="flex:1"><b>${esc(p.name)}</b><small>${priceH(p)} · stok ${p.stock}</small></div></div><div class="urow" style="margin-top:8px"><small>Diskon ${disc(p)}%</small><div class="urow"><button class="btn alt" style="${B2}" onclick="stepDisc(${p.id},-10)">−10%</button><button class="btn alt" style="${B2}" onclick="stepDisc(${p.id},10)">+10%</button></div></div><div class="urow" style="margin-top:6px"><button class="btn alt" style="${B2}" onclick="stepDisc(${p.id},0)">Hapus diskon</button><button class="btn" style="${B2};${RED}" onclick="delProd(${p.id})">Hapus item</button></div></div>`).join('')||empty('Belum ada item. Tambah lewat kotak Tambah item.'));
};
async function stepDisc(id,d){
  const p=prods.find(x=>x.id==id),v=d==0?0:Math.min(100,Math.max(0,(p.discount_percent||0)+d));
  const{error}=await SB.from('products').update({discount_percent:v}).eq('id',id);
  if(error)return toast(error.message);
  p.discount_percent=v;toast(v?'Diskon '+v+'%':'Diskon dihapus');openBox('mine');
}
async function editProd(id){
  const row={name:$('#en').value.trim(),price:+$('#ep').value,stock:+$('#es').value,image_url:$('#ei').value.trim(),description:$('#edd').value.trim(),payment_qr_url:$('#eq').value.trim()||null};
  if($('#ed'))row.discount_percent=Math.min(100,Math.max(0,+$('#ed').value||0));
  if(!row.name||!row.price)return toast('Isi nama dan harga');
  const{error}=await SB.from('products').update(row).eq('id',id);
  if(error)return toast(error.message);
  closeM();await load();toast('Item diperbarui');render();
}
async function delProd(id){
  if(!confirm('Hapus item ini? Riwayat transaksi tetap tersimpan.'))return;
  const{error}=await SB.from('products').update({active:false}).eq('id',id);
  if(error)return toast(error.message);
  closeM();await load();toast('Item dihapus');render();
}
async function addCat(){
  const name=$('#cn').value.trim();if(!name)return toast('Isi nama kategori');
  const{error}=await SB.from('categories').insert({name,created_by:me.id,parent_id:+$('#cp').value||null,image_url:$('#ci').value.trim()||null});
  if(error)return toast(error.message);
  await load();toast('Kategori ditambahkan');render();
}
async function addProd(){
  const row={seller_id:me.id,category_id:+$('#pc').value,name:$('#pn').value.trim(),price:+$('#pp').value,stock:+$('#ps').value,image_url:$('#pi').value.trim(),description:$('#pd').value.trim(),payment_qr_url:$('#pq').value.trim()||null};
  if(!row.category_id||!row.name||!row.price)return toast('Isi kategori, nama, dan harga');
  if(!row.payment_qr_url)return toast('Upload QR pembayaran dulu');
  const{error}=await SB.from('products').insert(row);
  if(error)return toast(error.message);
  await load();toast('Item ditambahkan');render();
}
const discBox=()=>`<h3>Diskon kategori</h3><select id="dc">${cats.map(c=>`<option value="${c.id}">${esc(path(c))} (${c.discount_percent||0}%)</option>`).join('')}</select><input id="dp" type="number" min="0" max="100" placeholder="Diskon (%), isi 0 untuk menghapus"><button class="btn" onclick="setDisc()">Simpan diskon</button><small>Berlaku ke semua sub-kategori dan item di dalamnya. Diskon per item diatur dari popup item.</small>`;
const catsBox=()=>`<h3>Kelola kategori</h3>`+(cats.map(c=>`<div class="uc"><small>${esc(path(c))}</small><input id="cnm${c.id}" value="${esc(c.name)}" placeholder="Nama"><label class="btn alt">Ganti gambar<input type="file" accept="image/*" onchange="upImg(this,'cim${c.id}')" hidden></label><input id="cim${c.id}" value="${esc(c.image_url||'')}" placeholder="Link gambar"><div class="urow"><button class="btn" style="${B2}" onclick="saveCat(${c.id})">Simpan</button><button class="btn" style="${B2};${RED}" onclick="delCat(${c.id})">Hapus</button></div></div>`).join('')||empty('Belum ada kategori.'));
async function bannerBox(){
  const{data:b}=await SB.from('banners').select('*').order('sort').order('id');
  return `<h3>Banner promo</h3><label class="btn alt">Upload banner<input type="file" accept="image/*" onchange="addBanner(this)" hidden></label>`+(b||[]).map(x=>`<div class="row"><img src="${esc(x.image_url)}" alt=""><div style="flex:1"><small>Banner ${x.id}</small></div><button class="btn" style="width:auto;margin:0;padding:8px 12px;${RED}" onclick="delBanner(${x.id})">Hapus</button></div>`).join('');
}
async function usersBox(){
  const{data:u}=await SB.from('profiles').select('*').order('name');users=u||[];
  return `<h3>Pengguna</h3><input id="us" placeholder="Cari nama akun" oninput="drawUsers()"><div id="ul">${usersH()}</div>`;
}
async function saveCat(id){
  const{error}=await SB.from('categories').update({name:document.getElementById('cnm'+id).value.trim(),image_url:document.getElementById('cim'+id).value.trim()||null}).eq('id',id);
  if(error)return toast(error.message);
  await load();toast('Kategori disimpan');render();
}
async function delCat(id){
  const ids=within(id),n=prods.filter(p=>ids.includes(p.category_id)).length,sub=ids.length-1;
  const nm=cats.find(c=>c.id==id)?.name;
  if(n>0){
    if(!confirm('Yakin ingin menghapus kategori "'+nm+'"?'))return;
    if(!confirm('Kategori ini masih berisi '+n+' item'+(sub?' dan '+sub+' sub-kategori':'')+'. Yakin ingin menghapus?'))return;
    if(!confirm('Verifikasi terakhir: semua isinya ikut terhapus dan tidak bisa dikembalikan. Hapus sekarang?'))return;
  }
  const{error}=await SB.rpc('delete_category',{cid:id,force:n>0});
  if(error)return toast(error.message);
  await load();toast('Kategori dihapus');render();
}
const B2='width:auto;margin:0;padding:10px 12px';
const usersH=()=>{const k=(document.getElementById('us')?.value||'').toLowerCase();return users.filter(u=>!k||(u.name||'').toLowerCase().includes(k)).map(u=>`<div class="uc"><div class="urow"><b>${esc(u.name||u.id.slice(0,8))}</b>${u.role=='admin'?'<small>Admin</small>':`<select onchange="setRole('${u.id}',this.value)">${['buyer','seller'].map(r=>`<option ${u.role==r?'selected':''}>${r}</option>`).join('')}</select>`}</div>`+(u.role!='buyer'?`<small>Koin ${rp(u.coins)} · bagi hasil ${u.share_percent}%</small><div class="urow"><input id="sp${u.id}" type="number" min="0" max="100" value="${u.share_percent}"><button class="btn" style="${B2}" onclick="saveShare('${u.id}')">Simpan %</button></div><div class="urow"><input id="cc${u.id}" type="number" min="1" placeholder="Jumlah koin"></div><div class="urow"><button class="btn" style="${B2}" onclick="adjCoin('${u.id}',1)">Tambah</button><button class="btn alt" style="${B2}" onclick="adjCoin('${u.id}',-1)">Kurangi</button></div>`:'')+(u.role=='seller'?`<button class="btn" style="${RED}" onclick="blockU('${u.id}')">Blok seller</button>`:'')+(u.blocked?`<small>Akun diblokir</small><button class="btn alt" onclick="unblockU('${u.id}')">Buka blokir</button>`:'')+(u.id!=me.id?`<button class="btn" style="${RED}" onclick="delUser('${u.id}')">Hapus akun permanen</button>`:'')+`</div>`).join('')||empty('Akun tidak ditemukan.')};
const drawUsers=()=>{document.getElementById('ul').innerHTML=usersH()};
async function saveShare(id){
  const v=Math.min(100,Math.max(0,+document.getElementById('sp'+id).value||0));
  const{error}=await SB.from('profiles').update({share_percent:v}).eq('id',id);
  if(error)return toast(error.message);
  users.find(x=>x.id==id).share_percent=v;drawUsers();toast('Persen disimpan');
}
async function adjCoin(id,sg){
  const n=Math.abs(Math.trunc(+document.getElementById('cc'+id).value))*sg;
  if(!n)return toast('Isi jumlah koin');
  const u=users.find(x=>x.id==id);
  if((u.coins||0)+n<0)return toast('Koin tidak cukup');
  await coin(id,n,sg>0?'Ditambah admin':'Dikurangi admin');u.coins=(u.coins||0)+n;drawUsers();toast(sg>0?'Koin ditambah':'Koin dikurangi');
}
async function delUser(id){
  if(!confirm('Hapus akun ini secara permanen? Tindakan ini tidak bisa dibatalkan.'))return;
  const{error}=await SB.rpc('admin_delete_user',{uid:id});
  if(error)return toast(error.message);
  users=users.filter(x=>x.id!=id);drawUsers();await load();toast('Akun dihapus');
}
async function blockU(id){
  if(!confirm('Blok seller ini? Perannya jadi buyer.'))return;
  const{error}=await SB.from('profiles').update({role:'buyer',blocked:true}).eq('id',id);
  if(error)return toast(error.message);
  toast('Seller diblokir');render();
}
async function unblockU(id){
  const{error}=await SB.from('profiles').update({blocked:false}).eq('id',id);
  if(error)return toast(error.message);
  toast('Blokir dibuka');render();
}
async function addBanner(el){
  const f=el.files[0];if(!f)return;
  if(f.size>5*1024*1024)return toast('Ukuran gambar maksimal 5 MB');
  toast('Mengunggah banner...');
  const pt='banners/'+Date.now()+'.'+(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const{error}=await SB.storage.from('images').upload(pt,f,{contentType:f.type});
  if(error)return toast(error.message);
  const url=SB.storage.from('images').getPublicUrl(pt).data.publicUrl;
  const r=await SB.from('banners').insert({image_url:url,sort:Date.now()%1000000});
  if(r.error)return toast(r.error.message);
  await load();toast('Banner ditambahkan');render();
}
async function delBanner(id){
  if(!confirm('Hapus banner ini?'))return;
  const{error}=await SB.from('banners').delete().eq('id',id);
  if(error)return toast(error.message);
  await load();toast('Banner dihapus');render();
}
async function setDisc(){
  const v=Math.min(100,Math.max(0,+$('#dp').value||0));
  const{error}=await SB.from('categories').update({discount_percent:v}).eq('id',+$('#dc').value);
  if(error)return toast(error.message);
  await load();toast('Diskon disimpan');render();
}

async function setRole(id,role){
  const{error}=await SB.from('profiles').update({role,blocked:false}).eq('id',id);
  toast(error?error.message:'Peran diubah');
}
const ARW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M5 12l6 6"/><path d="M5 12l6-6"/></svg>';
const PLUS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const SEND='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14l11-11"/><path d="M21 3l-6.5 18a.55.55 0 0 1-1 0l-3.5-7l-7-3.5a.55.55 0 0 1 0-1l18-6.5"/></svg>';
function baseT(){try{let v=localStorage.getItem('wk_base_'+me.id);if(!v){v=new Date().toISOString();localStorage.setItem('wk_base_'+me.id,v)}return v}catch(e){return new Date().toISOString()}}
const readT=o=>{try{return localStorage.getItem('wk_read_'+me.id+'_'+o)||baseT()}catch(e){return baseT()}};
function markRead(o,t){try{localStorage.setItem('wk_read_'+me.id+'_'+o,t)}catch(e){}}
let unread={};
async function refreshChatBadge(){
  const b=$('#cb');if(!b)return;
  if(!me){b.hidden=true;return}
  const{data}=await SB.from('messages').select('sender_id,created_at').neq('sender_id',me.id).order('created_at',{ascending:false}).limit(200);
  unread={};
  (data||[]).forEach(x=>{if(new Date(x.created_at)>new Date(readT(x.sender_id)))unread[x.sender_id]=(unread[x.sender_id]||0)+1});
  const n=Object.values(unread).reduce((a,c)=>a+c,0);
  b.hidden=!n;b.textContent=n>9?'9+':n;
}
let nlist=[];
const seenKey=()=>'wk_seen_'+(me?.id||'');
function seen(){try{let v=localStorage.getItem(seenKey());if(!v){v=new Date().toISOString();localStorage.setItem(seenKey(),v)}return v}catch(e){return new Date(0).toISOString()}}
async function getNotifs(){
  if(!me)return[];
  const[m,o,u]=await Promise.all([
    SB.from('messages').select('*').neq('sender_id',me.id).order('created_at',{ascending:false}).limit(15),
    SB.from('orders').select('*,products(name)').order('updated_at',{ascending:false}).limit(15),
    SB.from('user_info').select('*')
  ]);
  uinfo=Object.fromEntries((u.data||[]).map(x=>[x.id,x]));
  const a=[];
  (m.data||[]).forEach(x=>a.push({t:x.created_at,txt:'Pesan dari '+(uinfo[x.sender_id]?.name||'pengguna')+': '+(x.body||'Gambar'),chat:{b:x.buyer_id,s:x.seller_id}}));
  (o.data||[]).forEach(x=>{
    const n=x.products?.name||'Item',buyer=x.buyer_id==me.id;
    if(buyer&&x.status=='pending')return;
    a.push({t:x.updated_at||x.created_at,txt:!buyer&&x.status=='pending'?'Pesanan baru: '+n:n+': '+ST[x.status]});
  });
  return a.sort((x,y)=>new Date(y.t)-new Date(x.t)).slice(0,20);
}
async function refreshNotif(){
  const b=$('#nb');if(!b)return;
  if(!me){b.hidden=true;return}
  nlist=await getNotifs();
  const sn=new Date(seen()),n=nlist.filter(x=>new Date(x.t)>sn).length;
  b.hidden=!n;b.textContent=n>9?'9+':n;
}
async function openNotif(){
  if(!me){toast('Masuk dulu untuk melihat notifikasi');return go('akun')}
  nlist=await getNotifs();
  const sn=new Date(seen());
  modal(`<h3>Notifikasi</h3><br>`+(nlist.map((x,i)=>`<div class="row" onclick="goNotif(${i})"><div style="flex:1"><b>${esc(x.txt)}</b><small>${new Date(x.t).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}${new Date(x.t)>sn?' · baru':''}</small></div></div>`).join('')||empty('Belum ada notifikasi.')));
  try{localStorage.setItem(seenKey(),new Date().toISOString())}catch(e){}
  $('#nb').hidden=true;
}
function goNotif(i){const x=nlist[i];closeM();if(x.chat){chatTo=x.chat;go('chat')}else go('transaksi')}
function toggleSearch(){
  const p=$('#sp'),open=p.classList.toggle('open');
  if(open)$('#q').focus();else{q='';$('#q').value='';render()}
}
function openChat(sid){
  if(!me){closeM();toast('Masuk dulu untuk chat');return go('akun')}
  chatTo={b:me.id,s:sid};closeM();go('chat');
}
async function chatV(){
  if(!me)return auth('Masuk untuk chat dengan penjual.');
  const{data:u}=await SB.from('user_info').select('*');
  uinfo=Object.fromEntries((u||[]).map(x=>[x.id,x]));
  if(chatTo){
    const o=uinfo[me.id==chatTo.b?chatTo.s:chatTo.b];
    setTimeout(()=>{drawMsgs(true);chatT=setInterval(drawMsgs,4000)},0);
    return `<div class="ctop"><button class="ic" onclick="chatTo=null;render()" aria-label="Kembali">${ARW}</button>${av(o)}<div><b>${esc(o?.name||'Pengguna')}</b><small>Tekan lama pesanmu untuk menghapus</small></div></div><div id="msgs"></div><div class="cbar"><label class="ic plus" aria-label="Kirim gambar">${PLUS}<input type="file" accept="image/*" onchange="sendImg(this)" hidden></label><input id="mi" placeholder="Tulis pesan" onkeydown="if(event.key=='Enter')sendMsg()"><button class="ic send" onclick="sendMsg()" aria-label="Kirim">${SEND}</button></div>`;
  }
  await refreshChatBadge();
  const{data}=await SB.from('messages').select('*').order('created_at',{ascending:false});
  const seen={},rows=[];
  (data||[]).forEach(m=>{const o=m.buyer_id==me.id?m.seller_id:m.buyer_id;if(!seen[o]){seen[o]=1;rows.push([o,m])}});
  return `<h3>Chat</h3><br>`+(rows.map(([o,m])=>`<div class="row" onclick="chatTo={b:${m.buyer_id==me.id?`'${me.id}'`:`'${m.buyer_id}'`},s:'${m.seller_id}'};render()">${av(uinfo[o])}<div style="flex:1"><b>${esc(uinfo[o]?.name||'Pengguna')}</b><small>${esc(m.body?m.body.slice(0,40):'Gambar')}</small></div>${unread[o]?`<span class="nb inl">${unread[o]}</span>`:''}</div>`).join('')||empty('Belum ada chat. Buka item lalu tekan Chat penjual.'));
}
async function drawMsgs(first){
  const e=$('#msgs');if(!e||!chatTo)return;
  const{data}=await SB.from('messages').select('*').eq('buyer_id',chatTo.b).eq('seller_id',chatTo.s).order('created_at');
  const inc=(data||[]).filter(m=>m.sender_id!=me.id).pop();
  if(inc){markRead(me.id==chatTo.b?chatTo.s:chatTo.b,inc.created_at);refreshChatBadge()}
  const atEnd=first===true||innerHeight+scrollY>=document.body.scrollHeight-140;
  e.innerHTML=(data||[]).map(m=>{const me_=m.sender_id==me.id;return `<div class="msg ${me_?'me':''}" ${me_?`oncontextmenu="delMsg(${m.id});return false"`:''}>${m.image_url?`<img class="mimg" src="${esc(m.image_url)}" alt="Gambar" onclick="window.open(this.src)">`:''}${esc(m.body)}</div>`}).join('')||empty('Belum ada pesan.');
  if(atEnd)scrollTo(0,document.body.scrollHeight);
}
async function delMsg(id){
  if(!confirm('Hapus pesan ini?'))return;
  const{error}=await SB.from('messages').delete().eq('id',id);
  if(error)return toast(error.message);
  drawMsgs();
}
async function sendMsg(){
  const i=$('#mi'),body=i.value.trim();if(!body)return;
  const{error}=await SB.from('messages').insert({buyer_id:chatTo.b,seller_id:chatTo.s,sender_id:me.id,body});
  if(error)return toast(error.message);
  i.value='';drawMsgs();
}
function payPop(p,o){
  const u=p.payment_qr_url;
  modal(`<h3>Bayar pesanan</h3><p class="pr">${rp(o.amount)}</p>${u?`<img src="${esc(u)}" alt="QR pembayaran" style="background:#fff;max-height:300px;object-fit:contain">`:'<p class="mut">Penjual belum menambahkan QR pembayaran. Hubungi penjual lewat chat.</p>'}<small>Screenshot atau unduh QR ini, bayar sesuai nominal, lalu kirim bukti pembayaran lewat chat penjual.</small>${u?`<button class="btn alt" onclick="dlQR('${esc(u)}')">Unduh QR</button>`:''}<button class="btn" onclick="openChat('${p.seller_id}')">Chat penjual</button><button class="btn alt" onclick="go('transaksi')">Lihat transaksi</button>`);
}
async function dlQR(u){
  try{const b=await(await fetch(u)).blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='qr-pembayaran.png';a.click()}
  catch(e){window.open(u,'_blank')}
}
async function sendImg(el){
  const f=el.files[0];if(!f)return;
  if(f.size>5*1024*1024)return toast('Ukuran gambar maksimal 5 MB');
  toast('Mengirim gambar...');
  const pt='chat/'+me.id+'/'+Date.now()+'.'+(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const{error}=await SB.storage.from('images').upload(pt,f,{contentType:f.type});
  if(error)return toast(error.message);
  const url=SB.storage.from('images').getPublicUrl(pt).data.publicUrl;
  const r=await SB.from('messages').insert({buyer_id:chatTo.b,seller_id:chatTo.s,sender_id:me.id,body:'',image_url:url});
  if(r.error)return toast(r.error.message);
  el.value='';drawMsgs();
}
setInterval(()=>{refreshNotif();refreshChatBadge()},10000);
setInterval(()=>{
  const e=$('.bn');
  if(!e||banners.length<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const w=e.clientWidth,n=(Math.round(e.scrollLeft/w)+1)%banners.length;
  e.scrollTo({left:n*w,behavior:'smooth'});
},3000);
init();
