const SB=supabase.createClient('https://ynchtzndogltyziitrqv.supabase.co','sb_publishable_30G6TknbWIajO8ewUpkAaw_DiRbErX1');
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp=n=>'Rp'+Number(n||0).toLocaleString('id-ID');
let me=null,prof=null,cats=[],prods=[],orders=[],sellers={},uinfo={},authMode=null,chatTo=null,chatT=null,banners=[],users=[],tab='home',cat=null,q='';

function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3000)}
function modal(h){$('#sheet').innerHTML=h;$('#modal').classList.add('show')}
function closeM(){$('#modal').classList.remove('show')}
function go(t){tab=t;render();scrollTo(0,0)}

async function setUser(u){
  me=u||null;prof=null;
  if(me){const{data}=await SB.from('profiles').select('*').eq('id',me.id).single();prof=data}
}
async function load(){
  const[c,p,b,si]=await Promise.all([
    SB.from('categories').select('*').order('name'),
    SB.from('products').select('*').eq('active',true).order('sold_count',{ascending:false}),
    SB.from('banners').select('*').eq('active',true).order('sort').order('id'),
    SB.from('seller_info').select('*')
  ]);
  if(c.error||p.error)toast('Gagal memuat data');
  cats=c.data||[];prods=p.data||[];banners=b.data||[];
  sellers=Object.fromEntries((si.data||[]).map(x=>[x.id,x]));
}
async function init(){
  const{data:{session}}=await SB.auth.getSession();
  await setUser(session?.user);await load();render();
}
async function render(){
  clearInterval(chatT);
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t==tab));
  $('#main').innerHTML=await({home,chat:chatV,transaksi:trx,akun}[tab])();
}

const sec=(t,h)=>`<h4>${t}</h4>${h}`;
const kids=id=>cats.filter(c=>c.parent_id==id);
const within=id=>[id,...kids(id).flatMap(c=>within(c.id))];
const path=c=>c.parent_id?path(cats.find(x=>x.id==c.parent_id)||{name:'?'})+' › '+c.name:c.name;
function disc(p){let d=p.discount_percent||0,c=cats.find(x=>x.id==p.category_id);while(c){d=Math.max(d,c.discount_percent||0);c=cats.find(x=>x.id==c.parent_id)}return d}
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
  h+=sec(cur?'Sub-kategori':'Kategori',`<div class="cats">${cl.map(c=>`<button class="cat" onclick="cat=${c.id};q='';$('#q').value='';render()">${esc(c.name)}${c.discount_percent?`<small>Diskon ${c.discount_percent}%</small>`:''}</button>`).join('')||empty(cur?'Tidak ada sub-kategori.':'Belum ada kategori.')}</div>`);
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
  closeM();toast('Pesanan dibuat. Kode: '+data.code);go('transaksi');
}

async function trx(){
  if(!me)return auth('Masuk untuk melihat transaksi.');
  const{data}=await SB.from('orders').select('*,products(name,image_url,sold_count)').order('created_at',{ascending:false});
  orders=data||[];
  return `<h3>Riwayat transaksi</h3><br>`+(orders.map(o=>`<div class="row" onclick="openO(${o.id})"><img src="${esc(o.products?.image_url)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(o.products?.name)}</b><small>${rp(o.amount)} · ${esc(o.status)} · ${o.buyer_id==me.id?'Beli':'Jual'}</small></div></div>`).join('')||empty('Belum ada transaksi.'));
}
function openO(id){
  const o=orders.find(x=>x.id==id);
  modal(`<h3>Detail transaksi</h3><p>${esc(o.products?.name)}</p><p class="pr">${rp(o.amount)}</p><small>Status ${esc(o.status)} · ${new Date(o.created_at).toLocaleString('id-ID')}</small><div class="code">${esc(o.code)}</div><small>Salin kode ini dan kirim ke seller untuk verifikasi.</small><button class="btn" onclick="copyC('${esc(o.code)}')">Salin kode</button>`+(prof?.role=='admin'&&o.status=='pending'?`<button class="btn alt" onclick="confirmO(${o.id})">Konfirmasi pembayaran</button>`:''));
}
function copyC(c){navigator.clipboard.writeText(c).then(()=>toast('Kode disalin'),()=>toast('Tekan lama kode untuk menyalin'))}
async function confirmO(id){
  const o=orders.find(x=>x.id==id);
  const{data:sp}=await SB.from('profiles').select('share_percent').eq('id',o.seller_id).single();
  const earn=Math.round(o.amount*(sp?.share_percent??50)/100),fee=o.amount-earn;
  const{error}=await SB.from('orders').update({status:'paid',admin_fee:fee,seller_earning:earn}).eq('id',id);
  if(error)return toast(error.message);
  await SB.from('products').update({sold_count:(o.products?.sold_count||0)+1}).eq('id',o.product_id);
  if(o.seller_id)await coin(o.seller_id,earn,'Penjualan '+o.code);
  await coin(me.id,fee,'Bagian admin '+o.code);
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
async function akun(){
  if(!me)return auth();
  const r=prof?.role||'buyer';
  let h=`<div class="who">${av(prof)}<div><h3>${esc(prof?.name||'Pengguna')}</h3><small>${esc(me.email)} · peran ${esc(r)}${r!='buyer'?' · koin '+rp(prof?.coins):''}</small></div></div><h4>Profil</h4><input id="pnm" value="${esc(prof?.name||'')}" placeholder="Nama"><button class="btn" onclick="saveName()">Simpan nama</button><label class="btn alt">Ganti foto profil<input type="file" accept="image/*" onchange="upAvatar(this)" hidden></label><button class="btn alt" onclick="logout()">Keluar</button>`;
  if(r!='buyer')h+=seller()+mine();
  if(r=='admin')h+=await adm();
  return h;
}
const seller=()=>`<h4>Tambah kategori</h4><input id="cn" placeholder="Nama kategori atau game"><select id="cp"><option value="">Kategori utama (tanpa induk)</option>${cats.map(c=>`<option value="${c.id}">Di dalam ${esc(path(c))}</option>`).join('')}</select><button class="btn" onclick="addCat()">Tambah kategori</button><h4>Tambah item</h4><select id="pc">${cats.map(c=>`<option value="${c.id}">${esc(path(c))}</option>`).join('')}</select><input id="pn" placeholder="Nama item"><input id="pd" placeholder="Deskripsi item"><input id="pp" type="number" placeholder="Harga (Rp)"><input id="ps" type="number" placeholder="Stok"><label class="btn alt">Pilih foto dari galeri<input id="pf" type="file" accept="image/*" onchange="upImg(this,'pi')" hidden></label><input id="pi" placeholder="Link gambar (terisi otomatis setelah pilih foto)"><button class="btn" onclick="addProd()">Simpan item</button>`;
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
const manage=p=>(prof&&prof.role!='buyer'&&(prof.role=='admin'||p.seller_id==me?.id))?`<h4>Atur item</h4><input id="en" value="${esc(p.name)}" placeholder="Nama item"><input id="ep" type="number" value="${p.price}" placeholder="Harga"><input id="es" type="number" value="${p.stock}" placeholder="Stok"><input id="edd" value="${esc(p.description||'')}" placeholder="Deskripsi"><label class="btn alt">Ganti foto<input id="ef" type="file" accept="image/*" onchange="upImg(this,'ei')" hidden></label><input id="ei" value="${esc(p.image_url)}" placeholder="Link gambar">${prof.role=='admin'?`<input id="ed" type="number" min="0" max="100" value="${p.discount_percent||0}" placeholder="Diskon item (%)">`:''}<button class="btn alt" onclick="editProd(${p.id})">Simpan perubahan</button><button class="btn" style="${RED}" onclick="delProd(${p.id})">Hapus item</button>`:'';
const mine=()=>{
  const l=prods.filter(p=>p.seller_id==me.id);
  return `<h4>Item saya</h4>`+(l.map(p=>`<div class="row" onclick="openP(${p.id})"><img src="${esc(p.image_url)}" alt="" onerror="this.style.visibility='hidden'"><div style="flex:1"><b>${esc(p.name)}</b><small>${rp(p.price)} · stok ${p.stock}</small></div><button class="btn" style="width:auto;margin:0;padding:8px 12px;${RED}" onclick="event.stopPropagation();delProd(${p.id})">Hapus</button></div>`).join('')||empty('Belum ada item. Tambah lewat form di atas.'));
};
async function editProd(id){
  const row={name:$('#en').value.trim(),price:+$('#ep').value,stock:+$('#es').value,image_url:$('#ei').value.trim(),description:$('#edd').value.trim()};
  if(prof.role=='admin'&&$('#ed'))row.discount_percent=Math.min(100,Math.max(0,+$('#ed').value||0));
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
  const{error}=await SB.from('categories').insert({name,created_by:me.id,parent_id:+$('#cp').value||null});
  if(error)return toast(error.message);
  await load();toast('Kategori ditambahkan');render();
}
async function addProd(){
  const row={seller_id:me.id,category_id:+$('#pc').value,name:$('#pn').value.trim(),price:+$('#pp').value,stock:+$('#ps').value,image_url:$('#pi').value.trim(),description:$('#pd').value.trim()};
  if(!row.category_id||!row.name||!row.price)return toast('Isi kategori, nama, dan harga');
  const{error}=await SB.from('products').insert(row);
  if(error)return toast(error.message);
  await load();toast('Item ditambahkan');render();
}
async function adm(){
  const[{data:u},{data:b}]=await Promise.all([SB.from('profiles').select('*').order('name'),SB.from('banners').select('*').order('sort').order('id')]);
  users=u||[];
  return `<h4>Banner promo</h4><label class="btn alt">Upload banner<input type="file" accept="image/*" onchange="addBanner(this)" hidden></label>`+(b||[]).map(x=>`<div class="row"><img src="${esc(x.image_url)}" alt=""><div style="flex:1"><small>Banner ${x.id}</small></div><button class="btn" style="width:auto;margin:0;padding:8px 12px;${RED}" onclick="delBanner(${x.id})">Hapus</button></div>`).join('')
  +`<h4>Diskon kategori</h4><select id="dc">${cats.map(c=>`<option value="${c.id}">${esc(path(c))} (${c.discount_percent||0}%)</option>`).join('')}</select><input id="dp" type="number" min="0" max="100" placeholder="Diskon (%), isi 0 untuk menghapus"><button class="btn" onclick="setDisc()">Simpan diskon</button><small>Berlaku ke semua sub-kategori dan item di dalamnya. Diskon per item diatur dari popup item.</small>`
  +`<h4>Pengguna</h4><input id="us" placeholder="Cari nama akun" oninput="drawUsers()"><div id="ul">${usersH()}</div>`;
}
const B2='width:auto;margin:0;padding:10px 12px';
const usersH=()=>{const k=(document.getElementById('us')?.value||'').toLowerCase();return users.filter(u=>!k||(u.name||'').toLowerCase().includes(k)).map(u=>`<div class="uc"><div class="urow"><b>${esc(u.name||u.id.slice(0,8))}</b><select onchange="setRole('${u.id}',this.value)">${['buyer','seller','admin'].map(r=>`<option ${u.role==r?'selected':''}>${r}</option>`).join('')}</select></div>`+(u.role!='buyer'?`<small>Koin ${rp(u.coins)} · bagi hasil ${u.share_percent}%</small><div class="urow"><input id="sp${u.id}" type="number" min="0" max="100" value="${u.share_percent}"><button class="btn" style="${B2}" onclick="saveShare('${u.id}')">Simpan %</button></div><div class="urow"><input id="cc${u.id}" type="number" min="1" placeholder="Jumlah koin"></div><div class="urow"><button class="btn" style="${B2}" onclick="adjCoin('${u.id}',1)">Tambah</button><button class="btn alt" style="${B2}" onclick="adjCoin('${u.id}',-1)">Kurangi</button></div>`:'')+(u.role=='seller'?`<button class="btn" style="${RED}" onclick="blockU('${u.id}')">Blok seller</button>`:'')+(u.blocked?`<small>Akun diblokir</small><button class="btn alt" onclick="unblockU('${u.id}')">Buka blokir</button>`:'')+(u.id!=me.id?`<button class="btn" style="${RED}" onclick="delUser('${u.id}')">Hapus akun permanen</button>`:'')+`</div>`).join('')||empty('Akun tidak ditemukan.')};
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
    setTimeout(()=>{drawMsgs();chatT=setInterval(drawMsgs,4000)},0);
    return `<button class="btn alt" onclick="chatTo=null;render()">‹ Kembali</button><div class="who sel">${av(o)}<b>${esc(o?.name||'Pengguna')}</b></div><div id="msgs"></div><div class="urow"><input id="mi" placeholder="Tulis pesan" onkeydown="if(event.key=='Enter')sendMsg()"><button class="btn" style="${B2}" onclick="sendMsg()">Kirim</button></div>`;
  }
  const{data}=await SB.from('messages').select('*').order('created_at',{ascending:false});
  const seen={},rows=[];
  (data||[]).forEach(m=>{const o=m.buyer_id==me.id?m.seller_id:m.buyer_id;if(!seen[o]){seen[o]=1;rows.push([o,m])}});
  return `<h3>Chat</h3><br>`+(rows.map(([o,m])=>`<div class="row" onclick="chatTo={b:${m.buyer_id==me.id?`'${me.id}'`:`'${m.buyer_id}'`},s:'${m.seller_id}'};render()">${av(uinfo[o])}<div><b>${esc(uinfo[o]?.name||'Pengguna')}</b><small>${esc(m.body.slice(0,40))}</small></div></div>`).join('')||empty('Belum ada chat. Buka item lalu tekan Chat penjual.'));
}
async function drawMsgs(){
  const e=$('#msgs');if(!e||!chatTo)return;
  const{data}=await SB.from('messages').select('*').eq('buyer_id',chatTo.b).eq('seller_id',chatTo.s).order('created_at');
  const atEnd=e.scrollHeight-e.scrollTop-e.clientHeight<60;
  e.innerHTML=(data||[]).map(m=>`<div class="msg ${m.sender_id==me.id?'me':''}">${esc(m.body)}</div>`).join('')||empty('Belum ada pesan.');
  if(atEnd)e.scrollTop=e.scrollHeight;
}
async function sendMsg(){
  const i=$('#mi'),body=i.value.trim();if(!body)return;
  const{error}=await SB.from('messages').insert({buyer_id:chatTo.b,seller_id:chatTo.s,sender_id:me.id,body});
  if(error)return toast(error.message);
  i.value='';drawMsgs();
}
setInterval(()=>{
  const e=$('.bn');
  if(!e||banners.length<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const w=e.clientWidth,n=(Math.round(e.scrollLeft/w)+1)%banners.length;
  e.scrollTo({left:n*w,behavior:'smooth'});
},3000);
init();
