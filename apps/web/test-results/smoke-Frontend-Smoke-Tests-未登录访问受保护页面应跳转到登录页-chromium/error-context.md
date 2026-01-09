# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - banner [ref=e2]:
        - link "Super Caterpillar Studio" [ref=e3] [cursor=pointer]:
            - /url: /
            - heading "Super Caterpillar Studio" [level=1] [ref=e5]
        - combobox [ref=e8]:
            - option "English" [selected]
            - option "中文"
    - main [ref=e9]:
        - generic [ref=e11]:
            - heading "登录" [level=1] [ref=e12]
            - generic [ref=e13]:
                - generic [ref=e14]:
                    - generic [ref=e15]: 邮箱
                    - textbox "邮箱" [ref=e16]:
                        - /placeholder: your@email.com
                - generic [ref=e17]:
                    - generic [ref=e18]: 密码
                    - textbox "密码" [ref=e19]:
                        - /placeholder: 至少 6 个字符
                - button "登录" [ref=e20] [cursor=pointer]
            - generic [ref=e21]:
                - text: 还没有账号？
                - link "注册" [ref=e22] [cursor=pointer]:
                    - /url: /en/register
```
