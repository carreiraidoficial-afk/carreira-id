(function () {
  function initShareBars() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var url = canonical ? canonical.href : location.href;
    var titleTag = document.querySelector('meta[property="og:title"]');
    var title = titleTag ? titleTag.content : document.title;

    var encodedUrl = encodeURIComponent(url);
    var encodedText = encodeURIComponent(title);

    document.querySelectorAll('.share-btn--whatsapp').forEach(function (el) {
      el.href = 'https://wa.me/?text=' + encodedText + '%20' + encodedUrl;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareBars);
  } else {
    initShareBars();
  }
})();
