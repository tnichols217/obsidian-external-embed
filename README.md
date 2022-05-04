# Obsidian Iframes
This plugin allows you to use the iframe tag in your obsidian notes to refer to local files.
Works by replacing the src attribute of the iframe tag with a global path using the file:// URI scheme.

## MD files
This plugin also allows you to "iframe" an MD file, which will include its code in the document (can be another document or an online source)

## Filesystem Access
- Starting a src with "/" will start from the root of your vault
- Starting without a slash will use relative directories from the current MD file
- If youd like to use a file outside of your valut, prefix the src with "file://"

## Example:
To use, just use the src attribute in an iframe tag:
![image](https://user-images.githubusercontent.com/62992267/166679372-ca3e8dcb-b5ce-47a0-b49a-09d71478f185.png)

Produced with the following MD:
```
# Stuff outside the iframe
- Example list

<iframe src="https://raw.githubusercontent.com/tnichols217/obsidian-columns/main/README.md" style="width: 100%; padding:50px"></iframe>
```


## Settings
### Allow Internet
Allows the plugin to include MD files from the internet.

## Bugs
v1.0.7 settings menu bug, will get fixed in 1.0.8
