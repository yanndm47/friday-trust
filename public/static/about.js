// Conçu par La TEAM 0
document.getElementById('y').textContent=new Date().getFullYear();
document.querySelectorAll('.shot img').forEach(i=>i.addEventListener('click',()=>{const o=document.createElement('div');o.className='modal';const m=document.createElement('img');m.src=i.src;m.alt=i.alt;m.className='big';o.append(m);o.addEventListener('click',()=>o.remove());document.body.append(o)}));
