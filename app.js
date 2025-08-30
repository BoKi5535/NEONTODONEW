// tiny helper stuff
(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const prettyDate = (d) => d ? new Date(d).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}) : '—';
  const todayISO = () => new Date().toISOString().slice(0,10);
  const makeId = () => (Date.now().toString(36)+Math.random().toString(36).slice(2,6)).toUpperCase();

  // theme toggle (simple)
  const root = document.documentElement;
  root.dataset.theme = localStorage.getItem('theme') || 'dark';
  $('#theme').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', root.dataset.theme);
  });

  // clock (hh:mm:ss + date)
  function drawClock(){
    const d = new Date();
    $('#clock-time').textContent = d.toLocaleTimeString(undefined, {hour12:false});
    $('#clock-date').textContent = d.toLocaleDateString(undefined, {weekday:'short', year:'numeric', month:'short', day:'numeric'});
  }
  drawClock();
  setInterval(drawClock, 1000);

  // state
  let items = JSON.parse(localStorage.getItem('tasks')||'[]');
  let dragging = null;

  const save = () => localStorage.setItem('tasks', JSON.stringify(items));

  // els
  const form = $('#form');
  const list = $('#list');
  const search = $('#search');
  const statusSel = $('#status');
  const sortSel = $('#sort');
  const clearBtn = $('#clear-done');

  // add
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#new').value.trim();
    if (!text) return;
    const t = {
      id: makeId(),
      text,
      done:false,
      created: new Date().toISOString(),
      due: $('#due').value || '',
      priority: $('#priority').value || 'normal',
      category: $('#category').value.trim(),
      order: items.length ? Math.max(...items.map(x=>x.order||0))+1 : 1
    };
    items.push(t);
    save();
    form.reset();
    $('#priority').value = 'normal';
    render();
  });

  clearBtn.addEventListener('click', () => {
    items = items.filter(x => !x.done);
    save(); render();
  });

  // filter + sort
  function pick(){
    const q = search.value.toLowerCase();
    const st = statusSel.value;
    const sort = sortSel.value;
    const res = items.filter(t => {
      const hit = t.text.toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q);
      const overdue = t.due && !t.done && new Date(t.due) < new Date(todayISO());
      const match =
        st === 'all' ? true :
        st === 'open' ? !t.done :
        st === 'done' ? t.done :
        st === 'overdue' ? overdue : true;
      return hit && match;
    });
    const rank = {low:0, normal:1, high:2, urgent:3};
    res.sort((a,b)=>{
      switch(sort){
        case 'created-asc':  return a.created.localeCompare(b.created);
        case 'created-desc': return b.created.localeCompare(a.created);
        case 'due-asc':      return (a.due||'9999').localeCompare(b.due||'9999');
        case 'due-desc':     return (b.due||'0000').localeCompare(a.due||'0000');
        case 'priority-asc': return rank[a.priority]-rank[b.priority];
        case 'priority-desc':return rank[b.priority]-rank[a.priority];
        default: return (a.order||0)-(b.order||0);
      }
    });
    return res;
  }
  ['input','change'].forEach(evt=>{
    search.addEventListener(evt, render);
    statusSel.addEventListener(evt, render);
    sortSel.addEventListener(evt, render);
  });

  // render
  const tpl = $('#item-template');
  const prioName = p => p[0].toUpperCase()+p.slice(1);
  const daysLeft = due => {
    if (!due) return null;
    const ms = (new Date(due) - new Date(todayISO()));
    return Math.ceil(ms/86400000);
  };

  function render(){
    list.innerHTML = '';
    const arr = pick();
    const frag = document.createDocumentFragment();
    arr.forEach(t => {
      const li = tpl.content.firstElementChild.cloneNode(true);
      li.dataset.id = t.id;
      if(t.done) li.classList.add('done');

      const chk = li.querySelector('input[type="checkbox"]');
      chk.checked = t.done;
      chk.addEventListener('change', () => {
        t.done = chk.checked; save(); render();
      });

      li.querySelector('.text').textContent = t.text;

      const pr = li.querySelector('.badge.prio');
      pr.textContent = prioName(t.priority);
      pr.classList.add(t.priority);

      const cat = li.querySelector('.badge.cat');
      cat.textContent = t.category ? t.category : 'No cat.';

      const due = li.querySelector('.badge.due');
      if (t.due){
        const d = daysLeft(t.due);
        due.textContent = prettyDate(t.due);
        due.classList.add(d < 0 ? 'overdue' : d <= 2 ? 'soon' : 'later');
      } else {
        due.textContent = 'No due';
      }

      li.querySelector('.meta').textContent = `Created ${new Date(t.created).toLocaleString()}`;

      li.querySelector('.del').addEventListener('click', () => {
        items = items.filter(x => x.id !== t.id);
        save(); render();
      });
      li.querySelector('.edit').addEventListener('click', () => openEdit(t.id));

      // drag reorder
      li.addEventListener('dragstart', (e)=>{
        dragging = t.id;
        e.dataTransfer.effectAllowed = 'move';
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', ()=> li.classList.remove('dragging'));
      li.addEventListener('dragover', (e)=>{
        e.preventDefault();
        const overId = li.dataset.id;
        if (dragging && overId && dragging !== overId){
          const a = items.findIndex(x=>x.id===dragging);
          const b = items.findIndex(x=>x.id===overId);
          const [mv] = items.splice(a,1);
          items.splice(b,0,mv);
          items.forEach((x,i)=>x.order=i+1);
          save(); render();
        }
      });

      frag.appendChild(li);
    });
    list.appendChild(frag);

    // stats + progress
    const total = items.length;
    const done = items.filter(x=>x.done).length;
    const open = total - done;
    $('#count-total').textContent = total;
    $('#count-done').textContent = done;
    $('#count-open').textContent = open;

    const pct = total ? Math.round((done/total)*100) : 0;
    $('#bar').style.setProperty('--w', pct+'%');
    $('#bar-label').textContent = pct+'%';
  }

  // edit modal
  const modal = $('#modal');
  const editForm = $('#edit-form');
  const cancelEdit = $('#cancel-edit');
  let editing = null;

  function openEdit(id){
    editing = id;
    const t = items.find(x=>x.id===id);
    if (!t) return;
    $('#edit-text').value = t.text;
    $('#edit-due').value = t.due || '';
    $('#edit-priority').value = t.priority || 'normal';
    $('#edit-category').value = t.category || '';
    modal.classList.remove('hidden');
  }
  function closeEdit(){
    modal.classList.add('hidden');
    editing = null;
  }
  cancelEdit.addEventListener('click', closeEdit);
  modal.addEventListener('click', (e)=>{ if(e.target === modal) closeEdit(); });

  editForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const t = items.find(x=>x.id===editing);
    if (!t) return;
    t.text = $('#edit-text').value.trim();
    t.due = $('#edit-due').value || '';
    t.priority = $('#edit-priority').value;
    t.category = $('#edit-category').value.trim();
    save(); closeEdit(); render();
  });

  // shortcuts
  document.addEventListener('keydown', (e)=>{
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)){
      e.preventDefault(); $('#search').focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n'){
      e.preventDefault(); $('#new').focus();
    }
    if (e.key === 'Escape'){ closeEdit(); }
  });

  // no seeding — starts empty
  render();
})();