(function () {
  function initShareBars() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var url = canonical ? canonical.href : location.href;
    var titleTag = document.querySelector('meta[property="og:title"]');
    var title = titleTag ? titleTag.content : document.title;

    var encodedUrl = encodeURIComponent(url);
    var encodedText = encodeURIComponent(title);

    // No desktop, wa.me costuma cair no WhatsApp Web/Desktop de um jeito que
    // cola a URL crua (nao decodificada) como texto da mensagem, e o preview
    // do link vira o do proprio api.whatsapp.com em vez do artigo. web.whatsapp.com/send
    // e o endpoint certo pra abrir o composer do WhatsApp Web corretamente no desktop.
    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    var whatsappBase = isMobile ? 'https://wa.me/?text=' : 'https://web.whatsapp.com/send?text=';

    document.querySelectorAll('.share-btn--whatsapp').forEach(function (el) {
      el.href = whatsappBase + encodedText + '%20' + encodedUrl;
    });
    document.querySelectorAll('.share-btn--facebook').forEach(function (el) {
      el.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
    });
    document.querySelectorAll('.share-btn--x').forEach(function (el) {
      el.href = 'https://twitter.com/intent/tweet?text=' + encodedText + '&url=' + encodedUrl;
    });

    document.querySelectorAll('.share-btn--copy').forEach(function (el) {
      el.addEventListener('click', function () {
        navigator.clipboard.writeText(url).then(function () {
          el.classList.add('is-copied');
          setTimeout(function () { el.classList.remove('is-copied'); }, 2000);
        }).catch(function () { /* clipboard indisponivel, ignora */ });
      });
    });

    if (navigator.share) {
      document.querySelectorAll('.share-btn--native').forEach(function (el) {
        el.style.display = 'inline-flex';
        el.addEventListener('click', function () {
          navigator.share({ title: title, url: url }).catch(function () { /* usuario cancelou */ });
        });
      });
    }
  }

  function initCardShareButtons() {
    document.querySelectorAll('.card-share-btn').forEach(function (btn) {
      var url = btn.getAttribute('data-share-url');
      var title = btn.getAttribute('data-share-title');
      if (!url) return;

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () { /* usuario cancelou */ });
          return;
        }

        navigator.clipboard.writeText(url).then(function () {
          btn.classList.add('is-copied');
          setTimeout(function () { btn.classList.remove('is-copied'); }, 2000);
        }).catch(function () { /* clipboard indisponivel, ignora */ });
      });
    });
  }

  function init() {
    initShareBars();
    initCardShareButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
