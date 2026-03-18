
(function(){
  const sharedPath = '../../_shared/js/background-injector.js';
  if (document.querySelector(`script[data-skye-bg-shared="${sharedPath}"]`)) return;
  const script = document.createElement('script');
  script.src = sharedPath;
  script.dataset.skyeBgShared = sharedPath;
  document.head.appendChild(script);
})();
