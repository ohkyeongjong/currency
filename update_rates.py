"""환율을 받아 rates.json으로 저장합니다. GitHub Actions가 하루 두 번 실행합니다."""
import json
import sys
import time
import urllib.request

KEEP = ['USD', 'EUR', 'JPY', 'CNY', 'KRW', 'TRY']


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'rates-updater'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def from_er_api():
    raw = get('https://open.er-api.com/v6/latest/USD')
    if raw.get('result') != 'success':
        raise ValueError('result is not success')
    return raw.get('time_last_update_unix'), {k: raw['rates'][k] for k in KEEP}


def from_frankfurter():
    raw = get('https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,CNY,KRW,TRY')
    rates = dict(raw['rates'])
    rates['USD'] = 1
    ts = int(time.mktime(time.strptime(raw['date'], '%Y-%m-%d')))
    return ts, {k: rates[k] for k in KEEP}


def main():
    errors = []
    for fn in (from_er_api, from_frankfurter):
        try:
            source_ts, rates = fn()
            if not all(isinstance(v, (int, float)) and v > 0 for v in rates.values()):
                raise ValueError('bad rate value')
            out = {
                'base': 'USD',
                'source': fn.__name__,
                'fetchedAt': int(time.time()),
                'sourceUpdatedAt': source_ts,
                'rates': rates,
            }
            with open('rates.json', 'w', encoding='utf-8') as f:
                json.dump(out, f, indent=1)
            print('ok', fn.__name__, rates)
            return 0
        except Exception as e:  # noqa: BLE001
            errors.append(fn.__name__ + ': ' + repr(e))
    print('all sources failed:', errors)
    return 1


if __name__ == '__main__':
    sys.exit(main())
