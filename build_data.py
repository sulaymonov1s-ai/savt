#!/usr/bin/env python3
import json
import os

ROOT = '/workspace/project'


def render(body):
    if not isinstance(body, list):
        return []
    parts = []
    for b in body:
        if b.get('type') == 2:
            parts.append({'img': 'images/img' + b.get('value', '')})
        else:
            parts.append({'text': b.get('value', '')})
    return parts


def build(src, dst, var):
    data = json.load(open(os.path.join(ROOT, src)))
    tests = data['tests']
    templates = data['list']['data']['data']

    out = {}
    for tid, t in tests.items():
        qs = (isinstance(t, dict) and t.get('data')) and t['data'].get('questions') or []
        if not isinstance(qs, list) or not qs:
            continue
        tpl_meta = next((x for x in templates if str(x['id']) == tid), {})
        qs_out = []
        for q in qs:
            ans = []
            for a in q.get('answers', []):
                ans.append({'body': render(a.get('body', [])), 'check': bool(a.get('check'))})
            qs_out.append({
                'body': render(q.get('body', [])),
                'answers': ans,
                'expl': q.get('answer_description') or '',
            })
        out[tid] = {'name': tpl_meta.get('name', tid), 'questions': qs_out}

    js = 'window.' + var + ' = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(ROOT, dst), 'w').write(js)
    print(dst, '->', var, '| templates:', len(out),
          'questions:', sum(len(v['questions']) for v in out.values()))


build('eavt_63_final.json', 'data.js', 'EAVT_DATA')
if os.path.exists(os.path.join(ROOT, 'eavt_uz.json')):
    build('eavt_uz.json', 'data_uz.js', 'EAVT_DATA_UZ')

