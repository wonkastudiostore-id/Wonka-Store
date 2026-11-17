const SB=supabase.createClient('https://ynchtzndogltyziitrqv.supabase.co','sb_publishable_30G6TknbWIajO8ewUpkAaw_DiRbErX1');
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp=n=>'Rp'+Number(n||0).toLocaleString('id-ID');
let me=null,prof=null,cats=[],prods=[],orders=[],tab='home',cat=null,q='';

function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3000)}
function modal(h){$('#sheet').innerHTML=h;$('#modal').classList.add('show')}
function closeM(){$('#modal').classList.remove('show')}
function go(t){tab=t;render();scrollTo(0,0)}

async function setUser(u){
  me=u||null;prof=null;
  if(me){const{data}=await SB.from('profiles').select('*').eq('id',me.id).single();prof=data}
}
async function load(){
  const[c,p]=await Promise.all([
    SB.from('categories').select('*').order('name'),
    SB.from('products').select('*').eq('active',true).order('sold_count',{ascending:false})
  ]);
  if(c.error||p.error)toast('Gagal memuat data');
  cats=c.data||[];prods=p.data||[];
}
async function init(){
  const{data:{session}}=await SB.auth.getSession();
  await setUser(session?.user);await load();render();
}
async function render(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t==tab));
  $('#main').innerHTML=await({home,transaksi:trx,akun}[tab])();
}

const sec=(t,h)=>`<h4>${t}</h4>${h}`;
const card=p=>`<div class="card" onclick="openP(${p.id})"><img src="${esc(p.image_url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div class="n">${esc(p.name)}</div><div class="pr">${rp(p.price)}</div><small>Terjual ${p.sold_count||0}</small></div>`;
const empty=t=>`<p class="mut">${t}</p>`;

function home(){
  const k=q.toLowerCase();
  const list=prods.filter(p=>(!cat||p.category_id==cat)&&(!k||p.name.toLowerCase().includes(k)));
  const cl=cats.filter(c=>!k||c.name.toLowerCase().includes(k));
  let h=`<div class="banner"><b>Tiket emas minggu ini</b><span>Diskon dan event terbaru tampil di sini.</span></div>`;
  if(cat||k)h+=sec(cat?'Item di '+esc(cats.find(c=>c.id==cat)?.name):'Hasil pencarian',`<div class="grid">${list.map(card).join('')||empty('Item tidak ditemukan.')}</div>`);
  h+=sec('Top Seller',`<div class="scroll">${prods.slice(0,8).map(card).join('')||empty('Belum ada item. Seller bisa menambah item di tab Akun.')}</div>`);
  h+=sec('Kategori',`<div class="cats">${cl.map(c=>`<button class="cat ${cat==c.id?'on':''}" onclick="cat=cat==${c.id}?null:${c.id};render()">${esc(c.name)}</button>`).join('')||empty('Belum ada kategori.')}</div>`);
  return h;
}

function openP(id){
  const p=prods.find(x=>x.id==id);
  modal(`<img src="${esc(p.image_url)}" alt="" onerror="this.remove()"><h3>${esc(p.name)}</h3><p class="pr">${rp(p.price)}</p><small>Stok ${p.stock}</small><button class="btn" onclick="buy(${p.id})">Beli sekarang</button>`+manage(p));
}
async function buy(id){
  if(!me){closeM();toast('Masuk dulu di tab Akun');return go('akun')}
  const p=prods.find(x=>x.id==id);
  if(p.stock<1)return toast('Stok habis');
  const{data,error}=await SB.from('orders').insert({buyer_id:me.id,seller_id:p.seller_id,product_id:p.id,amount:p.price}).select().single();
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
  const{data:s}=await SB.from('settings').select('value').eq('key','admin_fee_percent').single();
  const fee=Math.round(o.amount*Number(s?.value||10)/100);
  const{error}=await SB.from('orders').update({status:'paid',admin_fee:fee,seller_earning:o.amount-fee}).eq('id',id);
  if(error)return toast(error.message);
  await SB.from('products').update({sold_count:(o.products?.sold_count||0)+1}).eq('id',o.product_id);
  closeM();await load();toast('Pembayaran dikonfirmasi');render();
}

function auth(msg){
  return `<h3>Masuk atau daftar</h3><small>${msg||''}</small><input id="em" type="email" placeholder="Email"><input id="pw" type="password" placeholder="Password (min. 6 karakter)"><input id="nm" placeholder="Nama (diisi saat daftar)"><button class="btn" onclick="login()">Masuk</button><button class="btn alt" onclick="signup()">Daftar</button>`;
}
async function login(){
  const{error}=await SB.auth.signInWithPassword({email:$('#em').value.trim(),password:$('#pw').value});
  if(error)return toast(error.message);
  const{data:{session}}=await SB.auth.getSession();await setUser(session.user);await load();render();
}
async function signup(){
  const{data,error}=await SB.auth.signUp({email:$('#em').value.trim(),password:$('#pw').value,options:{data:{name:$('#nm').value.trim()}}});
  if(error)return toast(error.message);
  if(!data.session)return toast('Cek email untuk konfirmasi, lalu masuk.');
  await setUser(data.session.user);await load();render();
}
async function logout(){await SB.auth.signOut();await setUser(null);render()}

async function akun(){
  if(!me)return auth();
  const r=prof?.role||'buyer';
  let h=`<h3>${esc(prof?.name||'Pengguna')}</h3><small>${esc(me.email)} · peran ${esc(r)}</small><button class="btn alt" onclick="logout()">Keluar</button>`;
  if(r!='buyer')h+=seller()+mine();
  if(r=='admin')h+=await adm();
  return h;
}
const seller=()=>`<h4>Tambah kategori</h4><input id="cn" placeholder="Nama kategori, contoh Roblox"><button class="btn" onclick="addCat()">Tambah kategori</button><h4>Tambah item</h4><select id="pc">${cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><input id="pn" placeholder="Nama item"><input id="pp" type="number" placeholder="Harga (Rp)"><input id="ps" type="number" placeholder="Stok"><input id="pf" type="file" accept="image/*" onchange="upImg(this,'pi')"><input id="pi" placeholder="Link gambar (terisi otomatis setelah pilih foto)"><button class="btn" onclick="addProd()">Simpan item</button>`;
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
const manage=p=>(prof&&prof.role!='buyer'&&(prof.role=='admin'||p.seller_id==me?.id))?`<h4>Atur item</h4><input id="en" value="${esc(p.name)}" placeholder="Nama item"><input id="ep" type="number" value="${p.price}" placeholder="Harga"><input id="es" type="number" value="${p.stock}" placeholder="Stok"><button class="btn alt" onclick="editProd(${p.id})">Simpan perubahan</button><button class="btn" style="${RED}" onclick="delProd(${p.id})">Hapus item</button>`:'';
const mine=()=>{
  const l=prods.filter(p=>p.seller_id==me.id);
  return `<h4>Item saya</h4>`+(l.map(p=>`<div class="row" onclick="openP(${p.id})"><img src="${esc(p.image_url)}" alt="" onerror="this.style.visibility='hidden'"><div style="flex:1"><b>${esc(p.name)}</b><small>${rp(p.price)} · stok ${p.stock}</small></div><button class="btn" style="width:auto;margin:0;padding:8px 12px;${RED}" onclick="event.stopPropagation();delProd(${p.id})">Hapus</button></div>`).join('')||empty('Belum ada item. Tambah lewat form di atas.'));
};
async function editProd(id){
  const row={name:$('#en').value.trim(),price:+$('#ep').value,stock:+$('#es').value};
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
  const{error}=await SB.from('categories').insert({name,created_by:me.id});
  if(error)return toast(error.message);
  await load();toast('Kategori ditambahkan');render();
}
async function addProd(){
  const row={seller_id:me.id,category_id:+$('#pc').value,name:$('#pn').value.trim(),price:+$('#pp').value,stock:+$('#ps').value,image_url:$('#pi').value.trim()};
  if(!row.category_id||!row.name||!row.price)return toast('Isi kategori, nama, dan harga');
  const{error}=await SB.from('products').insert(row);
  if(error)return toast(error.message);
  await load();toast('Item ditambahkan');render();
}
async function adm(){
  const[{data:u},{data:s}]=await Promise.all([SB.from('profiles').select('*'),SB.from('settings').select('value').eq('key','admin_fee_percent').single()]);
  return `<h4>Bagi hasil admin</h4><small>Persen untuk sistem dari tiap transaksi.</small><input id="fee" type="number" value="${esc(s?.value||10)}"><button class="btn" onclick="saveFee()">Simpan persen</button><h4>Pengguna</h4>`+(u||[]).map(x=>`<div class="urow"><span>${esc(x.name||x.id.slice(0,8))}</span><select onchange="setRole('${x.id}',this.value)">${['buyer','seller','admin'].map(r=>`<option ${x.role==r?'selected':''}>${r}</option>`).join('')}</select></div>`).join('');
}
async function saveFee(){
  const{error}=await SB.from('settings').upsert({key:'admin_fee_percent',value:String(+$('#fee').value)});
  toast(error?error.message:'Persen disimpan');
}
async function setRole(id,role){
  const{error}=await SB.from('profiles').update({role}).eq('id',id);
  toast(error?error.message:'Peran diubah');
}
init();
