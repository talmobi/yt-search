// test ctoken post requests

const dasu = require( 'dasu' )

// curl 'https://www.youtube.com/results?search_query=superman+theme&pbj=1
// &ctoken=EpUDEg5zdXBlcm1hbiB0aGVtZRqCA1NCU0NBUXRsT1haeVprVnZZemhmWjRJQkN6YzRUakpUVURaS1JtRkpnZ0VMU1ZGMFMycFZYM0JQZFhlQ0FRdHZiR2MxZGxJMFVHeDVUWUlCQzNsRFEzRmZObUZ1YTBGSmdnRUxVa001VTA1NVVuQmljMi1DQVF0RlFtRjBlRm81TUhkaFo0SUJDMUZ0U0doSlJGVnlaRlpCZ2dFTGJHSmpjbGRhUzFVd2JrR0NBUXRDZGxWdU5rRlhiM0ZWUllJQkMyODNVSFYyWlZsdFJWZFZnZ0VMU0VwWFVUVXlPSHBaUWxtQ0FRc3RhRFZ4V0RoclREZHhPSUlCQzFKck1XRlJlRGxvVkdGRmdnRUxkelJQWkVsUFIwSlhNbEdDQVExU1JHVTVkbkptUlc5ak9GOW5nZ0VMTWpBMVJrMUtTbUo0VDFXQ0FRdGtkRlJmT1Rkd2VEaHpVWUlCQzBoSVNIVklPWEY1TVdsSmdnRUxPWHBuUzBJMlpuaGhjMDNxQXdBJTNEGLze6Bg%253D
// &continuation=EpUDEg5zdXBlcm1hbiB0aGVtZRqCA1NCU0NBUXRsT1haeVprVnZZemhmWjRJQkN6YzRUakpUVURaS1JtRkpnZ0VMU1ZGMFMycFZYM0JQZFhlQ0FRdHZiR2MxZGxJMFVHeDVUWUlCQzNsRFEzRmZObUZ1YTBGSmdnRUxVa001VTA1NVVuQmljMi1DQVF0RlFtRjBlRm81TUhkaFo0SUJDMUZ0U0doSlJGVnlaRlpCZ2dFTGJHSmpjbGRhUzFVd2JrR0NBUXRDZGxWdU5rRlhiM0ZWUllJQkMyODNVSFYyWlZsdFJWZFZnZ0VMU0VwWFVUVXlPSHBaUWxtQ0FRc3RhRFZ4V0RoclREZHhPSUlCQzFKck1XRlJlRGxvVkdGRmdnRUxkelJQWkVsUFIwSlhNbEdDQVExU1JHVTVkbkptUlc5ak9GOW5nZ0VMTWpBMVJrMUtTbUo0VDFXQ0FRdGtkRlJmT1Rkd2VEaHpVWUlCQzBoSVNIVklPWEY1TVdsSmdnRUxPWHBuUzBJMlpuaGhjMDNxQXdBJTNEGLze6Bg%253D
// &itct=CEAQybcCIhMIn7apy5qV5wIVWwqyCh1oZw2j'
// 
// -H 'authority: www.youtube.com' 
// -H 'pragma: no-cache' 
// -H 'cache-control: no-cache'
// -H 'origin: https://www.youtube.com'
// -H 'x-youtube-device: cosver=10_13_6&cbr=Chrome&cos=Macintosh&cbrver=79.0.3945.117' 
// -H 'x-youtube-page-label: youtube.ytfe.desktop_20200117_9_RC0' 
// -H 'x-youtube-page-cl: 290386204' 
// -H 'x-spf-referer: https://www.youtube.com/results?search_query=superman+theme' 
// -H 'x-youtube-utc-offset: 120' 
// -H 'x-spf-previous: https://www.youtube.com/results?search_query=superman+theme' 
// -H 'x-youtube-time-zone: Europe/Helsinki' 
// -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36' 
// -H 'x-youtube-variants-checksum: b9ea5cb49f716e7de4293ba79df06ecf' 
// -H 'content-type: application/x-www-form-urlencoded' 
// -H 'x-youtube-client-name: 1' 
// -H 'x-youtube-client-version: 2.20200118.09.00' 
// -H 'x-youtube-identity-token: QUFFLUhqbUc2WHBCTWJ5R0ZQN2N0TlA5bjdfSU5OeTlZQXw=' 
// -H 'x-youtube-ad-signals: dt=1579627374706&flash=0&frm&u_tz=120&u_his=4&u_java&u_h=900&u_w=1440&u_ah=877&u_aw=1440&u_cd=24&u_nplug=3&u_nmime=4&bc=31&bih=797&biw=735&brdim=0%2C23%2C0%2C23%2C1440%2C23%2C1440%2C877%2C735%2C797&vis=1&wgl=true&ca_type=image' 
// -H 'accept: */*' 
// -H 'x-client-data: CIW2yQEIorbJAQjBtskBCKmdygEIvLDKAQj3tMoBCJe1ygEImLXKAQjttcoBGKukygEY97bKAQ==' 
// -H 'sec-fetch-site: same-origin' 
// -H 'sec-fetch-mode: cors' 
// -H 'referer: https://www.youtube.com/results?search_query=superman+theme' 
// -H 'accept-encoding: gzip, deflate, br' 
// -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8,fi;q=0.7' 
// -H 'cookie: CONSENT=YES+FI.en+V8; VISITOR_INFO1_LIVE=m5TsCixS804; SID=WQe3vOUgCav4DyvwcDIfKu9EHz27zV4hmvalpDqAVSXKIVmJVvw5u0sPJp792DSb9cAvhA.; HSID=AR_i9MPcpAozZaNFJ; SSID=AnSAUGL10uCVo78k_; APISID=VA56nUvDJKslivkk/A1_u3sKQ4UnUj601B; SAPISID=2zDRMeGe64CgESMn/AViWqr5xjwIM8Ki7j; LOGIN_INFO=AFmmF2swRgIhAK4RpI_rD0cLehUgFM8tQHK4JEg0saIpaJ6H2dHyje3nAiEAxaWDuxrGoYbmj6QVjqhqFbmGc-8IBOt7gkzdORaTJ38:QUQ3MjNmeUI0QmZ1LUNUbHZwZU56SGx6cGF0TXNVdmZ5b2NlWWVSbWVpTEwyaUJiRlM5cUlKa2d1X24tTXFKbDdLeEtXZEN5NU85amZ5eTdKYnRsOUVHZ3JBT0JuR1JxVEJvQ0d0Vl8wZHpiYTlWaGpGdTFFd1gxSjgxaDB1UTVtWDhBX1E0TUJ5cTkxMlF5QmxkV3RlYktvS09mdnk0dF9ld3V3SUlEYndoTTkyMEc2LTZVOEQ4; PREF=al=en-GB&f1=50000000; YSC=jNd0IYfQgEE; SIDCC=AN0-TYtGLcT4SwCVu7ehWWLEqmdEqiBmNy7AeyLXuyukGBKt7OrbY4Gsukx2nDrDap8qVV4uQCY' --data 'session_token=QUFFLUhqbjVIb0hRSTYyQlEzQktUVzR0Y25HOV9JQ1JfZ3xBQ3Jtc0tuQmFvVGd2UGxnSk16VVJWWDJZT19RTDJ1SG0tS3FLTzdrMldfNm9YZmMtN0lGenlXTWZsTGFpV2VlTFowMTcyMlhFbTY5STFqemdRWlJiMnphZmxnQjNCSm9Ma3B2aF9YS2tsSXlBcTNrUUJza2NlZU5hTnROWUEyTTVTb1llX0Z2WFgxZ25aRElhUEVqdGQ2M0dpTjdqUHhVbFE%3D' --compressed

const ctoken = 'ErMDEg5zdXBlcm1hbiB0aGVtZRqCA1NCU0NBUXRsT1haeVprVnZZemhmWjRJQkN6YzRUakpUVURaS1JtRkpnZ0VMUlVKaGRIaGFPVEIzWVdlQ0FRdFNRemxUVG5sU2NHSnpiNElCQzI5c1p6VjJValJRYkhsTmdnRUxkelJQWkVsUFIwSlhNbEdDQVF0U2F6RmhVWGc1YUZSaFJZSUJDME13TWtSdU5VOWxaWFZGZ2dFTGJHSmpjbGRhUzFVd2JrR0NBUXRSYlVob1NVUlZjbVJXUVlJQkMycFdUUzF3VTBRd1VXeEpnZ0VMV2xsUVUweHZha1JaVERTQ0FRdGtkRlJmT1Rkd2VEaHpVWUlCQzBoSVNIVklPWEY1TVdsSmdnRUxTMmxHWDAwM2JWWkpTMFdDQVExU1JHVTVkbkptUlc5ak9GOW5nZ0VMTFVwelNsVlhja05oTW5PQ0FRczVlbWRMUWpabWVHRnpUWUlCQzNnMUxVSnJiWFpJWm5aQmdnRUxjREJ6ZDBGTFV5MDFjVUhxQXdBJTNEygEbGhdodHRwczovL3d3dy55b3V0dWJlLmNvbSIAGLze6Bg%3D'

if ( require.main === module ) {
  console.log( 'running' )

  const params = {
    protocol: 'https:',
    hostname: 'www.youtube.com',
    path: '/results?hl=en&gl=US&search_query=superman+theme&ctoken=' + ctoken,
    method: 'POST',

    headers: {
      'accept-encoding': 'gzip',
      'accept-language': 'en-GB,en-US',
      // 'accept': '*/*',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36',
      // 'pragma': 'no-cache' ,
      // 'cache-control': 'no-cache'
    }
  }

  dasu.req( params, function ( err, res, body ) {
    if ( err ) throw err

    console.log( 'status: ' + res.status )
    const fs = require( 'fs' )
    fs.writeFileSync( 'post.response', body, 'utf8' )
  } )
}
