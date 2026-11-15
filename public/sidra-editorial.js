/* Sidra Tourism editorial UI behavior. No credentials, fare or payment data handled here. */
(() => {
  'use strict';
  const menuButton=document.getElementById('shopMenuButton');
  const menu=document.getElementById('shopTravelMenu');
  const packageTabs=document.querySelector('.package-tabs');
  const cards=Array.from(document.querySelectorAll('.package-card[data-destination]'));
  const supportsMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true;
  if(menu&&menuButton){
    const closeMenu=()=>{menu.hidden=true;menuButton.setAttribute('aria-expanded','false');};
    menuButton.addEventListener('click',()=>{
      menu.hidden=!menu.hidden;
      menuButton.setAttribute('aria-expanded',String(!menu.hidden));
    });
    document.addEventListener('click',(event)=>{
      if(!event.target.closest('.shop-menu'))closeMenu();
    });
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape')closeMenu();});
    menu.addEventListener('click',closeMenu);
  }

  /* Preserve the existing verified flight and other supplier-quote forms. */
  document.addEventListener('click',(event)=>{
    const link=event.target.closest('[data-go-service]');
    if(!link)return;
    const kind=link.dataset.goService;
    if(!['flights','hotels','cars','holidays','experiences','cruises'].includes(kind))return;
    event.preventDefault();
    if(typeof window.switchMain==='function')window.switchMain(kind);
    document.getElementById('flights')?.scrollIntoView({behavior:supportsMotion?'smooth':'auto',block:'center'});
  });

  /* This is a visual destination selector, not inventory retrieval. */
  if(packageTabs){
    packageTabs.addEventListener('click',(event)=>{
      const button=event.target.closest('button[data-package-destination]');
      if(!button)return;
      const destination=button.dataset.packageDestination;
      packageTabs.querySelectorAll('button[data-package-destination]').forEach(tab=>{
        const active=tab===button;
        tab.classList.toggle('active',active);
        tab.setAttribute('aria-pressed',String(active));
      });
      for(const card of cards)card.hidden=card.dataset.destination!==destination;
      const rail=document.getElementById('packageRail');
      if(rail)rail.scrollLeft=0;
    });
    packageTabs.addEventListener('keydown',(event)=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      const buttons=Array.from(packageTabs.querySelectorAll('button[data-package-destination]'));
      const index=buttons.indexOf(document.activeElement);
      if(index<0)return;
      event.preventDefault();
      const next=(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      buttons[next].focus();
      buttons[next].click();
    });
  }

  document.addEventListener('click',(event)=>{
    const button=event.target.closest('button[data-scroll-target]');
    if(!button)return;
    const rail=document.getElementById(button.dataset.scrollTarget);
    if(!rail)return;
    const card=rail.firstElementChild;
    const distance=(card?.getBoundingClientRect().width||270)+18;
    const step=Number(button.dataset.direction)===-1?-distance:distance;
    rail.scrollBy({left:step,behavior:supportsMotion?'smooth':'auto'});
  });

  /* Offer a useful fallback for travel images that fail to load. */
  for(const photo of document.querySelectorAll('.inspiration-photo img,.stay-type-card img,.package-card img')){
    photo.addEventListener('error',()=>{
      photo.closest('.inspiration-photo,.stay-type-card,.package-card')?.classList.add('image-unavailable');
      photo.style.visibility='hidden';
    },{once:true});
  }
})();
