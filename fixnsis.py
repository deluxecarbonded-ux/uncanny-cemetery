import sys
p = '/mnt/c/Users/user/Downloads/exb/exotic-browser/scripts/installer.nsi'
s = open(p, encoding='utf-8').read()
s = s.replace('/home/user/exotic-browser', '${ROOT_DIR}')
open(p, 'w', encoding='utf-8').write(s)
print('done')
