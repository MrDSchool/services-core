import _ from 'underscore';
import moment from 'moment';
import m from 'mithril';
import prop from 'mithril/stream';
import { catarse } from './api';
import contributionVM from './vms/contribution-vm';

function getCallStack() {
    const callStackStr = new Error().stack;
    const callStackLines = callStackStr.split('\n');
    const callStackTrimmedLines = callStackLines.map(d => d.trim());
    const realCallStack = callStackTrimmedLines.filter((k, i) => i > 0);
    return realCallStack;
}

function RedrawScheduler() {
    let redrawsRequestCounter = 0;
    const markedCallStack = {};
    const requestAnimationFramePolyfill = (function() {
        if (window.requestAnimationFrame !== undefined) {
            return window.requestAnimationFrame;
        } else {
            return function requesterTimeout(functionToCall) {
                setTimeout(functionToCall, 100);
            };
        }
    })();

    RedrawScheduler.schedule = () => {
        redrawsRequestCounter++;
        /// #if DEBUG
        markedCallStack[redrawsRequestCounter] = getCallStack();
        /// #endif
    };

    function start() {
        if (redrawsRequestCounter > 0) {
            /// #if DEBUG
            const callStack = markedCallStack[redrawsRequestCounter];
            /// #endif

            if (redrawsRequestCounter === 1) {
                m.redraw();
            }

            redrawsRequestCounter = Math.max(0, --redrawsRequestCounter);
        }

        requestAnimationFramePolyfill(start);
    }

    start();
}

RedrawScheduler();

const { CatarseAnalytics, $ } = window;
const _dataCache = {},
    autoRedrawProp = startData => {
        const p = prop(startData);

        function dataUpdater(newData) {
            if (newData !== undefined) {
                p(newData);
                //m.redraw();
                RedrawScheduler.schedule();
            }

            return p();
        }

        dataUpdater.prototype = p;
        return dataUpdater;
    },
    hashMatch = str => window.location.hash === str,
    mobileScreen = () => window.screen && window.screen.width <= 767,
    paramByName = name => {
        const normalName = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]'),
            regex = new RegExp(`[\\?&]${normalName}=([^&#]*)`),
            results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    },
    selfOrEmpty = (obj, emptyState = '') => obj || emptyState,
    setMomentifyLocale = () => {
        moment.locale('pt', {
            months: 'Janeiro_Fevereiro_Março_Abril_Maio_Junho_Julho_Agosto_Setembro_Outubro_Novembro_Dezembro'.split('_'),
            monthsShort: 'jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez'.split('_'),
            relativeTime: {
                future: 'em %s',
                past: 'há %s',
                s: 'segundos',
                m: 'um minuto',
                mm: '%d minutos',
                h: 'uma hora',
                hh: '%d horas',
                d: 'um dia',
                dd: '%d dias',
                M: 'um mês',
                MM: '%d meses',
                y: 'um ano',
                yy: '%d anos',
            },
        });
    },
    lastDayOfNextMonth = () =>
        moment()
            .add(1, 'months')
            .format('D/MMMM'),
    existy = x => x != null,
    slugify = str =>
        window.replaceDiacritics(
            str
                .toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '')
        ),
    momentify = (date, format) => {
        format = format || 'DD/MM/YYYY';
        return date
            ? moment(date)
                  .locale('pt')
                  .format(format)
            : 'no date';
    },
    getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    storeAction = (action, value) => {
        if (!localStorage.getItem(action)) {
            return localStorage.setItem(action, String(value));
        }
    },
    storeObject = (sessionKey, obj) => sessionStorage.setItem(sessionKey, JSON.stringify(obj)),
    getStoredObject = sessionKey => {
        if (sessionStorage.getItem(sessionKey)) {
            return JSON.parse(String(sessionStorage.getItem(sessionKey)));
        }
        return null;
    },
    callStoredAction = action => {
        const item = localStorage.getItem(action);

        if (item) {
            localStorage.removeItem(action);
            return item;
        }
        return null;
    },
    capitalize = string => string.charAt(0).toUpperCase() + string.slice(1),
    discuss = (page, identifier) => {
        const d = document,
            s = d.createElement('script');
        window.disqus_config = function() {
            this.page.url = page;
            this.page.identifier = identifier;
        };
        s.src = '//catarseflex.disqus.com/embed.js';
        s.setAttribute('data-timestamp', String(+new Date()));
        (d.head || d.body).appendChild(s);
        return m('');
    },
    validateEmail = email => {
        const re = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
        return re.test(email);
    },
    validateCnpj = cnpjStr => {
        let tamanho, numeros, digitos, soma, pos, resultado;
        const cnpj = cnpjStr.replace(/[^\d]+/g, '');

        if (cnpj == '') {
            return false;
        }

        if (cnpj.length != 14) {
            return false;
        }

        if (
            cnpj == '00000000000000' ||
            cnpj == '11111111111111' ||
            cnpj == '22222222222222' ||
            cnpj == '33333333333333' ||
            cnpj == '44444444444444' ||
            cnpj == '55555555555555' ||
            cnpj == '66666666666666' ||
            cnpj == '77777777777777' ||
            cnpj == '88888888888888' ||
            cnpj == '99999999999999'
        ) {
            return false;
        }

        tamanho = cnpj.length - 2;
        numeros = cnpj.substring(0, tamanho);
        digitos = cnpj.substring(tamanho);
        soma = 0;
        pos = tamanho - 7;

        for (let i = tamanho; i >= 1; i--) {
            soma += Number(numeros.charAt(tamanho - i)) * pos--;
            if (pos < 2) {
                pos = 9;
            }
        }
        resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        if (String(resultado) != digitos.charAt(0)) {
            return false;
        }

        tamanho += 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += Number(numeros.charAt(tamanho - i)) * pos--;
            if (pos < 2) {
                pos = 9;
            }
        }
        resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        if (String(resultado) != digitos.charAt(1)) {
            return false;
        }

        return true;
    },
    validateCpf = strCPF => {
        let sum = 0,
            remainder;

        if (strCPF == '00000000000') return false;

        for (let i = 1; i <= 9; i++) {
            sum += parseInt(strCPF.substring(i - 1, i)) * (11 - i);
        }
        remainder = (sum * 10) % 11;

        if (remainder == 10 || remainder == 11) {
            remainder = 0;
        }

        if (remainder != parseInt(strCPF.substring(9, 10))) {
            return false;
        }

        sum = 0;

        for (let i = 1; i <= 10; i++) {
            sum += parseInt(strCPF.substring(i - 1, i)) * (12 - i);
        }

        remainder = (sum * 10) % 11;

        if (remainder == 10 || remainder == 11) {
            remainder = 0;
        }

        if (remainder != parseInt(strCPF.substring(10, 11))) {
            return false;
        }

        return true;
    },
    validationErrors = prop([]),
    resetValidations = () => validationErrors([]),
    validate = () => {
        const errorFields = prop([]);

        return {
            submit(fields, fn) {
                return () => {
                    resetValidations();

                    _.map(fields, field => {
                        if (field.rule === 'email') {
                            if (!validateEmail(field.prop())) {
                                validationErrors().push({
                                    field: field.prop,
                                    message: 'E-mail inválido.',
                                });
                            }
                        }

                        if (field.rule === 'text') {
                            if (field.prop().trim() === '') {
                                validationErrors().push({
                                    field: field.prop,
                                    message: 'O campo não pode ser vazio.',
                                });
                            }
                        }
                    });

                    return !validationErrors().length > 0 ? fn() : false;
                };
            },
            hasError(fieldProp) {
                return _.reduce(validationErrors(), (memo, fieldError) => fieldError.field() === fieldProp() || memo, false);
            },
        };
    },
    momentFromString = (date, format) => {
        const european = moment(date, format || 'DD/MM/YYYY');
        return european.isValid() ? european : moment(date);
    },
    translatedTimeUnits = {
        days: 'dias',
        minutes: 'minutos',
        hours: 'horas',
        seconds: 'segundos',
    },
    // Object manipulation helpers
    translatedTime = time => {
        const translatedTime = translatedTimeUnits,
            unit = () => {
                const projUnit = translatedTime[time.unit || 'seconds'];

                return Number(time.total) <= 1 ? projUnit.slice(0, -1) : projUnit;
            };

        return {
            unit: unit(),
            total: time.total,
        };
    },
    // Number formatting helpers
    generateFormatNumber = (s, c) => (number, n, x) => {
        if (!_.isNumber(number)) {
            return null;
        }

        const re = `\\d(?=(\\d{${x || 3}})+${n > 0 ? '\\D' : '$'})`,
            num = number.toFixed(Math.max(0, ~~n));
        return (c ? num.replace('.', c) : num).replace(new RegExp(re, 'g'), `$&${s || ','}`);
    },
    formatNumber = generateFormatNumber('.', ','),
    toggleProp = (defaultState, alternateState) => {
        const p = prop(defaultState);
        p.toggle = () => p(p() === alternateState ? defaultState : alternateState);

        return p;
    },
    idVM = catarse.filtersVM({
        id: 'eq',
    }),
    isDevEnv = () => {
        const root = document.getElementById('catarse_bootstrap'),
            data = root && root.getAttribute('data-environment');

        return data && data == 'development';
    },
    getCurrentProject = () => {
        if (_dataCache.currentProject) {
            return _dataCache.currentProject;
        }

        const root = document.getElementById('application'),
            data = root && root.getAttribute('data-parameters');
        if (data) {
            return (_dataCache.currentProject = JSON.parse(data));
        }
        return null;
    },
    getRdToken = () => {
        if (_dataCache.rdToken) {
            return _dataCache.rdToken;
        }

        const meta = _.first(document.querySelectorAll('[name=rd-token]'));
        return meta ? (_dataCache.rdToken = meta.getAttribute('content')) : null;
    },
    getSimilityCustomer = () => {
        if (_dataCache.similityCustomer) {
            return _dataCache.similityCustomer;
        }

        const meta = _.first(document.querySelectorAll('[name=simility-customer]'));
        return meta ? (_dataCache.similityCustomer = meta.getAttribute('content')) : null;
    },
    getNewsletterUrl = () => {
        if (_dataCache.newsletterUrl) {
            return _dataCache.newsletterUrl;
        }

        const meta = _.first(document.querySelectorAll('[name=newsletter-url]'));
        return meta ? (_dataCache.newsletterUrl = meta.getAttribute('content')) : null;
    },
    getUser = () => {
        if (_dataCache.user) {
            return _dataCache.user;
        }

        const body = document.getElementsByTagName('body'),
            data = _.first(body).getAttribute('data-user');
        if (data) {
            return (_dataCache.user = JSON.parse(data));
        }
        return null;
    },
    getUserID = () => {
        const user = getUser();
        return user == null || user.user_id == null ? null : user.user_id;
    },
    userSignedIn = () => !_.isNull(getUserID()),
    getBlogPosts = () => {
        if (_dataCache.blogPosts) {
            return _dataCache.blogPosts;
        }

        const posts = _.first(document.getElementsByTagName('body')).getAttribute('data-blog');

        if (posts) {
            return (_dataCache.blogPosts = JSON.parse(posts));
        }
        return null;
    },
    getApiHost = () => {
        if (_dataCache.apiHost) {
            return _dataCache.apiHost;
        }

        const el = document.getElementById('api-host');
        return (_dataCache.apiHost = el && el.getAttribute('content'));
    },
    locationActionMatch = action => {
        const act = window.location.pathname.split('/').slice(-1)[0];
        return action === act;
    },
    useAvatarOrDefault = avatarPath => avatarPath || '/assets/catarse_bootstrap/user.jpg',
    // Templates
    loader = () => m('.u-text-center.u-margintop-30 u-marginbottom-30', [m('img[alt="Loader"][src="https://s3.amazonaws.com/catarse.files/loader.gif"]')]),
    newFeatureBadge = () => m('span.badge.badge-success.margin-side-5', window.I18n.t('projects.new_feature_badge')),
    fbParse = () => {
        const tryParse = () => {
            try {
                window.FB.XFBML.parse();
            } catch (e) {
                // console.log(e);
            }
        };

        return window.setTimeout(tryParse, 500); // use timeout to wait async of facebook
    },
    pluralize = (count, s, p) => (count > 1 ? count + p : count + s),
    strip = html => {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    },
    simpleFormat = (str = '') => {
        str = str.replace(/\r\n?/, '\n');
        if (str.length > 0) {
            str = str.replace(/\n\n+/g, '</p><p>');
            str = str.replace(/\n/g, '<br />');
            str = `<p>${str}</p>`;
        }
        return str;
    },
    rewardSouldOut = reward => {
        const noRemainingRewards = reward.maximum_contributions > 0 ? reward.paid_count + reward.waiting_payment_count >= reward.maximum_contributions : false;
        return noRemainingRewards || reward.run_out;
    },
    rewardRemaning = reward => reward.maximum_contributions - (reward.paid_count + reward.waiting_payment_count),
    parseUrl = href => {
        const l = document.createElement('a');
        l.href = href;
        return l;
    },
    UIHelper = () => vnode => {
        if (window.$ && window.UIHelper) {
            window.UIHelper.setupResponsiveIframes($(vnode.dom));
        }
    },
    toAnchor = () => vnode => {
        const hash = window.location.hash.substr(1);
        if (hash === vnode.dom.id) {
            window.location.hash = '';
            setTimeout(() => {
                window.location.hash = vnode.dom.id;
            });
        }
    },
    navigateToDevise = params => {
        if (params) {
            window.location.href = `/${window.I18n.locale}/login${params}`;
        } else {
            window.location.href = `/${window.I18n.locale}/login`;
        }

        return false;
    },
    navigateTo = path => {
        window.location.href = path;
        return false;
    },
    cumulativeOffset = element => {
        let top = 0,
            left = 0;
        do {
            top += element.offsetTop || 0;
            left += element.offsetLeft || 0;
            element = element.offsetParent;
        } while (element);

        return {
            top,
            left,
        };
    },
    closeModal = () => {
        // Temp for rails unstyled close links
        const close = (elm, selector) => {
            const all = document.getElementsByClassName(selector);
            let cur = elm.parentNode;
            while (cur && !_.contains(all, cur)) {
                cur = cur.parentNode;
            }
            if (cur) {
                cur.style.display = 'none';
            }
            return cur;
        };

        const elById = document.getElementById('modal-close');
        if (_.isElement(elById)) {
            elById.onclick = event => {
                event.preventDefault();
                close(elById, 'modal-backdrop');
            };
        }

        const els = document.getElementsByClassName('modal-close');
        _.map(els, el => {
            if (_.isElement(el)) {
                el.onclick = event => {
                    event.preventDefault();
                    close(el, 'modal-backdrop');
                };
            }
        });
    },
    closeFlash = () => {
        const el = document.getElementsByClassName('icon-close')[0];
        if (_.isElement(el)) {
            el.onclick = event => {
                event.preventDefault();
                if (el.parentElement) {
                    el.parentElement.remove();
                }
            };
        }
    },
    i18nScope = (scope, obj) => {
        obj = obj || {};
        return _.extend({}, obj, {
            scope,
        });
    },
    redrawHashChange = before => {
        const callback = _.isFunction(before)
            ? () => {
                  before();
                  m.redraw();
              }
            : m.redraw;

        window.addEventListener('hashchange', callback, false);
    },
    authenticityToken = () => {
        const meta = _.first(document.querySelectorAll('[name=csrf-token]'));
        return meta ? meta.getAttribute('content') : null;
    },
    authenticityParam = () => {
        const meta = _.first(document.querySelectorAll('[name=csrf-param]'));
        return meta ? meta.getAttribute('content') : null;
    },
    animateScrollTo = el => {
        let scrolled = window.scrollY;

        const offset = cumulativeOffset(el).top,
            duration = 300,
            dFrame = (offset - scrolled) / duration,
            // EaseInOutCubic easing function. We'll abstract all animation funs later.
            eased = t => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
            animation = setInterval(() => {
                const pos = eased(scrolled / offset) * scrolled;

                window.scrollTo(0, pos);

                if (scrolled >= offset) {
                    clearInterval(animation);
                }

                scrolled += dFrame;
            }, 1);
    },
    scrollTop = () => window.scrollTo(0, 0),
    scrollTo = () => {
        const setTrigger = (el, anchorId) => {
            el.onclick = () => {
                const anchorEl = document.getElementById(anchorId);

                if (_.isElement(anchorEl)) {
                    animateScrollTo(anchorEl);
                }

                return false;
            };
        };

        return localVnode => {
            if (localVnode.dom.hash) {
                setTrigger(localVnode.dom, localVnode.dom.hash.slice(1));
            }
        };
    },
    projectStateTextClass = (state, has_cancelation_request) => {
        const statusText = {
            online: {
                cssClass: 'text-success',
                text: 'NO AR',
            },
            successful: {
                cssClass: 'text-success',
                text: 'FINANCIADO',
            },
            failed: {
                cssClass: 'text-error',
                text: 'NÃO FINANCIADO',
            },
            waiting_funds: {
                cssClass: 'text-waiting',
                text: 'AGUARDANDO',
            },
            rejected: {
                cssClass: 'text-error',
                text: 'CANCELADO',
            },
            draft: {
                cssClass: '',
                text: 'RASCUNHO',
            },
            in_analysis: {
                cssClass: '',
                text: 'EM ANÁLISE',
            },
            approved: {
                cssClass: 'text-success',
                text: 'APROVADO',
            },
        };

        if (has_cancelation_request) {
            return {
                cssClass: 'text-error',
                text: 'AGUARDANDO CANCELAMENTO',
            };
        }
        return statusText[state];
    },
    RDTracker = eventId => () => {
        const integrationScript = document.createElement('script');
        integrationScript.type = 'text/javascript';
        integrationScript.id = 'RDIntegration';

        if (!document.getElementById(integrationScript.id)) {
            document.body.appendChild(integrationScript);
            integrationScript.onload = () => window.RdIntegration.integrate(getRdToken(), eventId);
            integrationScript.src = 'https://d335luupugsy2.cloudfront.net/js/integration/stable/rd-js-integration.min.js';
        }

        return false;
    },
    analyticsEvent = (eventObj, fn = Function.prototype) => {
        // https://developers.google.com/analytics/devguides/collection/analyticsjs/command-queue-reference#send
        if (!eventObj) {
            return fn;
        }

        return data => {
            try {
                if (!eventObj.project) {
                    eventObj.project = getCurrentProject();
                }
                if (!eventObj.user) {
                    eventObj.user = getUser();
                }
                CatarseAnalytics.event(eventObj);
            } catch (e) {
                // console.error('[h.analyticsEvent] error:', e);
            }
            fn(data);
        };
    },
    _analyticsOneTimeEventFired = {},
    analyticsOneTimeEvent = (eventObj, fn) => {
        if (!eventObj) {
            return fn;
        }

        const eventKey = _.compact([eventObj.cat, eventObj.act]).join('_');
        if (!eventKey) {
            throw new Error('Should inform cat or act');
        }
        return () => {
            if (!_analyticsOneTimeEventFired[eventKey]) {
                // console.log('oneTimeEvent',eventKey);
                _analyticsOneTimeEventFired[eventKey] = true;
                const fireEvent = analyticsEvent(eventObj, fn);
                fireEvent();
            }
        };
    },
    monetaryToFloat = propValue => {
        if (_.isNumber(propValue())) {
            return parseFloat(propValue());
        }

        return parseFloat(
            propValue()
                .replace('.', '')
                .replace(',', '.')
        );
    },
    applyMonetaryMask = number => {
        let onlyNumbers = String(number).replace(/[^0-9]|[.]/g, ''),
            integerPart = onlyNumbers.slice(0, onlyNumbers.length - 2),
            decimalPart = onlyNumbers.slice(onlyNumbers.length - 2);

        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        return `${integerPart},${decimalPart}`;
    },
    noNumbersMask = value => value.replace(/[0-9]/g, ''),
    numbersOnlyMask = value => value.replace(/[^0-9]/g, ''),
    addChar = (position, maskChar) => char => string => {
        if (string.length === position && char !== maskChar) {
            return string + maskChar;
        }
        return string;
    },
    readMaskDefinition = maskCharDefinitions => maskDefinition =>
        _.compact(_.map(maskDefinition, (letter, index) => (letter in maskCharDefinitions ? null : [index, letter]))),
    isCharAllowed = maskCharDefinitions => maskDefinition => (position, newChar) => {
        if (position >= maskDefinition.length) {
            return false;
        }

        const maskChar = maskDefinition.charAt(position);
        if (maskChar in maskCharDefinitions) {
            return maskCharDefinitions[maskChar].test(newChar);
        }
        return newChar === maskChar || isCharAllowed(maskCharDefinitions)(maskDefinition)(position + 1, newChar);
    },
    applyMask = maskDefinition => {
        const maskFunctions = _.map(maskDefinition, maskChar => addChar(maskChar[0], maskChar[1]));
        return (string, newChar) => {
            const addNewCharFunctions = _.map(maskFunctions, el => el(newChar));
            const applyMaskFunctions = _.reduce(addNewCharFunctions, (memo, f) =>
                _.isFunction(memo)
                    ? _.compose(
                          f,
                          memo
                      )
                    : f
            );
            return applyMaskFunctions(string);
        };
    },
    // Adapted from https://github.com/diogob/jquery.fixedmask
    mask = (maskDefinition, value) => {
        const maskCharDefinitions = {
                9: /\d/, // String key needed to avoid flowType error
                A: /[a-zA-Z]/,
            },
            readMask = readMaskDefinition(maskCharDefinitions),
            isStrCharAllowed = isCharAllowed(maskCharDefinitions),
            applyValueMask = applyMask(readMask(maskDefinition)),
            restrictInput = isStrCharAllowed(maskDefinition);

        return _.reduce(
            value,
            (memo, chr) => {
                if (restrictInput(memo.length, chr)) {
                    memo = applyValueMask(memo, chr) + chr;
                }
                return memo;
            },
            ''
        );
    },
    removeStoredObject = sessionKey => sessionStorage.removeItem(sessionKey),
    currentProject = prop(),
    setProject = project => {
        currentProject(project);
    },
    getProject = () => currentProject,
    currentReward = prop(),
    setReward = reward => {
        currentReward(reward);
    },
    getReward = () => currentReward,
    buildLink = (link, refStr) => `/${link}${refStr ? `?ref=${refStr}` : ''}`,
    analyticsWindowScroll = eventObj => {
        if (eventObj) {
            setTimeout(() => {
                const u = window.location.href;
                let fired = false;
                window.addEventListener('scroll', function sc(e) {
                    //console.log('windowScroll');
                    const same = window.location.href === u;
                    if (same && !fired && window.$ && $(document).scrollTop() > $(window).height() / 2) {
                        fired = true;
                        const fireEvent = analyticsEvent(eventObj);
                        fireEvent();
                        window.removeEventListener('scroll', sc);
                    } else if (!same) {
                        window.removeEventListener('scroll', sc);
                    }
                });
            }, 1000);
        }
    },
    analytics = {
        event: analyticsEvent,
        oneTimeEvent: analyticsOneTimeEvent,
        windowScroll: analyticsWindowScroll,
    },
    projectFullPermalink = project => {
        let permalink;
        if (typeof project === 'function') {
            permalink = project().permalink;
        } else {
            permalink = project.permalink;
        }

        return `https://www.catarse.me/${permalink}`;
    },
    isHome = () => {
        const path = window.location.pathname;

        return path == '/en' || path == '/';
    },
    isProjectPage = () => {
        const path = window.location.pathname || '',
            isOnInsights = path.indexOf('/insights') > -1,
            isOnFiscal = path.indexOf('/fiscal') > -1,
            isOnEdit = path.indexOf('/edit') > -1,
            isOnContribution = path.indexOf('/contribution') > -1;

        return !isOnEdit && !isOnInsights && !isOnContribution && !isOnFiscal;
    },
    setPageTitle = title => vnode => {
        const titleEl = document.getElementsByTagName('title')[0],
            currentTitle = titleEl.innerText;

        if (currentTitle !== title) {
            return (titleEl.innerText = title);
        }
    },
    checkReminder = () => {
        const reminder = sessionStorage.getItem('reminder');

        if (reminder && isHome()) {
            window.location.href = `/projects/${reminder}`;
        }
    },
    rootUrl = () => {
        if (_dataCache.rootUrl) {
            return _dataCache.rootUrl;
        }

        const meta = _.first(document.querySelectorAll('[name=root-url]'));

        return meta ? (_dataCache.rootUrl = meta.getAttribute('content')) : null;
    },
    redactorConfig = params => ({
        source: false,
        formatting: ['p'],
        formattingAdd: [
            {
                tag: 'blockquote',
                title: 'Citar',
                class: 'fontsize-base quote',
                clear: true,
            },

            {
                tag: 'p',
                title: 'Cabeçalho 1',
                class: 'fontsize-larger fontweight-semibold',
                clear: true,
            },
            {
                tag: 'p',
                title: 'Cabeçalho 2',
                class: 'fontsize-large',
                clear: true,
            },
        ],
        lang: 'pt_br',
        maxHeight: 800,
        minHeight: 300,
        convertVideoLinks: true,
        convertUrlLinks: true,
        convertImageLinks: false,
        // You can specify, which ones plugins you need.
        // If you want to use plugins, you have add plugins to your
        // application.js and application.css files and uncomment the line below:
        // "plugins": ['fontsize', 'fontcolor', 'fontfamily', 'fullscreen', 'textdirection', 'clips'],
        plugins: ['video'],
        imageUpload: `/redactor_rails/pictures?${params}`,
        imageGetJson: '/redactor_rails/pictures',
        path: '/assets/redactor-rails',
        css: 'style.css',
    }),
    setRedactor = (
        prop,
        isInit = false //(el, isInit) => {
    ) => vnode => {
        if (!isInit) {
            const el = vnode.dom;
            const $editor = window.$(el);
            const csrf_token = authenticityToken();
            const csrf_param = authenticityParam();
            let params = '';
            if (csrf_param && csrf_token) {
                params = `${csrf_param}=${encodeURIComponent(csrf_token)}`;
            }
            $editor.redactor(redactorConfig(params));
            $editor.redactor('code.set', prop());
            // If we need to get redactor values and send it to js objects we'll have to add
            // a hook on the change.callback.redactor event. e.g.:
            // $editor.on('change.callback.redactor', () => prop($editor.redactor('code.get')) );
            // TODO: workaround to get redactor data
            window.$('.redactor-editor').on('blur', () => prop($editor.redactor('code.get')));
        }
    },
    redactor = (name, prop) =>
        m('textarea.input_field.redactor.w-input.text-field.bottom.jumbo.positive', {
            name,
            oncreate: setRedactor(prop),
        }),
    setCsrfToken = xhr => {
        if (authenticityToken()) {
            xhr.setRequestHeader('X-CSRF-Token', authenticityToken());
        }
    },
    contributionStatusBadge = contribution => {
        const status = {
            delivered: m('span.fontsize-smallest.badge.badge-success', 'Enviada'),
            received: m('span.fontsize-smallest.badge.badge-success', 'Recebida'),
            undelivered: m('span.fontsize-smallest.badge.badge-light', 'Não enviada'),
            error: m('span.fontsize-smallest.badge.badge-attention', 'Erro no envio'),
        };

        return contributionVM.canBeDelivered(contribution) ? status[contribution.delivery_status] : '';
    },
    getParams = searchKey => {
        const query = window.location.href;
        const queryParams = (/^[?#]/.test(query) ? query.slice(1) : query).split('?');

        return queryParams.length > 1
            ? queryParams[1].split('&').reduce((params, param) => {
                  const [key, value] = param.split('=');
                  params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
                  return params;
              }, {})[searchKey]
            : null;
    },
    stripScripts = s => {
        const div = document.createElement('div');
        div.innerHTML = s;
        const scripts = div.getElementsByTagName('script');
        let i = scripts.length;
        while (i--) {
            scripts[i].parentNode.removeChild(scripts[i]);
        }
        return div.innerHTML;
    },
    sleep = time => {
        const p = new Promise((resolve, reject) => {
            setTimeout(resolve, time);
        });

        return p;
    },
    createRequestRedrawWithCountdown = countdown => {
        countdown = countdown || 0;
        return () => {
            countdown = Math.max(0, countdown - 1);
            if (countdown <= 0) {
                m.redraw();
            }
        };
    },
    createRequestAutoRedraw = function() {
        return createRequestRedrawWithCountdown(arguments.length);
    },
    redraw = function() {
        RedrawScheduler.schedule();
    },
    createBasicPaginationVMWithAutoRedraw = vmInstance => {
        const error = prop(false);
        const errorMessage = prop('');

        return {
            isLastPage: vmInstance.isLastPage,
            isLoading: vmInstance.isLoading,
            collection: vmInstance.collection,
            total: vmInstance.total,
            error,
            errorMessage,
            firstPage: params => {
                return new Promise((resolve, reject) => {
                    vmInstance
                        .firstPage(params)
                        .then(data => {
                            error(false);
                            errorMessage('');
                            resolve(data);
                            redraw();
                        })
                        .catch(errorString => {
                            error(true);
                            errorMessage(errorString);
                            reject(errorString);
                            redraw();
                        });
                });
            },
            nextPage: () => {
                return new Promise((resolve, reject) => {
                    vmInstance
                        .nextPage()
                        .then(data => {
                            error(false);
                            errorMessage('');
                            resolve(data);
                            redraw();
                        })
                        .catch(errorString => {
                            error(true);
                            errorMessage(errorString);
                            reject(errorString);
                            redraw();
                        });
                });
            },
        };
    };

setMomentifyLocale();
closeFlash();
closeModal();
checkReminder();

export default {
    redraw,
    getCallStack,
    createRequestRedrawWithCountdown,
    createBasicPaginationVMWithAutoRedraw,
    createRequestAutoRedraw,
    autoRedrawProp,
    sleep,
    stripScripts,
    authenticityParam,
    authenticityToken,
    buildLink,
    contributionStatusBadge,
    cumulativeOffset,
    discuss,
    existy,
    slugify,
    validateEmail,
    validateCpf,
    validateCnpj,
    momentify,
    momentFromString,
    lastDayOfNextMonth,
    formatNumber,
    idVM,
    getUser,
    getUserID,
    getSimilityCustomer,
    getApiHost,
    getNewsletterUrl,
    getCurrentProject,
    getParams,
    toggleProp,
    loader,
    newFeatureBadge,
    fbParse,
    pluralize,
    simpleFormat,
    translatedTime,
    rewardSouldOut,
    rewardRemaning,
    parseUrl,
    hashMatch,
    mobileScreen,
    redrawHashChange,
    useAvatarOrDefault,
    locationActionMatch,
    navigateToDevise,
    navigateTo,
    storeAction,
    callStoredAction,
    UIHelper,
    toAnchor,
    capitalize,
    paramByName,
    i18nScope,
    RDTracker,
    selfOrEmpty,
    animateScrollTo,
    scrollTo,
    scrollTop,
    getRandomInt,
    projectStateTextClass,
    validationErrors,
    validate,
    analytics,
    strip,
    storeObject,
    getStoredObject,
    removeStoredObject,
    setProject,
    getProject,
    setReward,
    getReward,
    applyMonetaryMask,
    noNumbersMask,
    numbersOnlyMask,
    monetaryToFloat,
    mask,
    projectFullPermalink,
    isProjectPage,
    setPageTitle,
    rootUrl,
    redactor,
    setCsrfToken,
    userSignedIn,
    isDevEnv,
};
