const CSRF_COOKIE_NAME = 'csrftoken'
const CSRF_HEADER_NAME = 'X-CSRFToken'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])
const csrfTokenCache = new Map()

function getCookie(name) {
  const prefix = `${name}=`
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length) || ''
}

function getRequestUrl(input) {
  const url = input instanceof Request ? input.url : String(input)

  try {
    return new URL(url, window.location.href)
  } catch {
    return null
  }
}

function isApiRequest(input) {
  const parsedUrl = getRequestUrl(input)
  return parsedUrl?.pathname.startsWith('/api/') || false
}

function getRequestMethod(input, init = {}) {
  return (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

const nativeFetch = window.fetch.bind(window)

async function getCsrfToken(input) {
  const requestUrl = getRequestUrl(input)
  const apiOrigin = requestUrl?.origin || window.location.origin

  if (!csrfTokenCache.has(apiOrigin)) {
    const csrfUrl = `${apiOrigin}/api/auth/csrf/`
    const csrfPromise = nativeFetch(csrfUrl, {
      credentials: 'include',
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => data.csrfToken || getCookie(CSRF_COOKIE_NAME))
      .catch(() => getCookie(CSRF_COOKIE_NAME))

    csrfTokenCache.set(apiOrigin, csrfPromise)
  }

  return csrfTokenCache.get(apiOrigin)
}

window.fetch = async (input, init = {}) => {
  const method = getRequestMethod(input, init)
  const shouldAttachCsrf =
    isApiRequest(input) &&
    !SAFE_METHODS.has(method) &&
    !String(input instanceof Request ? input.url : input).endsWith('/api/auth/csrf/')

  if (!shouldAttachCsrf) {
    return nativeFetch(input, init)
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init.headers || {}).forEach((value, key) => {
    headers.set(key, value)
  })

  const csrfToken = await getCsrfToken(input)
  if (csrfToken && !headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  return nativeFetch(input, {
    ...init,
    credentials: init.credentials || 'include',
    headers,
  })
}
