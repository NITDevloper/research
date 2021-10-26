(function() {
    setTimeout(() => {
        // eslint-disable-next-line global-require
        require('./polyfills.js');
        // eslint-disable-next-line global-require
        setTimeout(() => require('./widget.jsx'), 0);
    }, 0);
})();
