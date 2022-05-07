# Obsidian Dynamic Import
This plugin allows you to use the iframe tag in your obsidian notes to refer to local files.\
Works by replacing the src attribute of the iframe tag with a global path using the file:// URI scheme.\
Also adds three custom syntaxes to import other files into the current file: iframe, import, and paste.\
For the iframe tag, to specify to attempt to convert the html to MD, use a class tag with the class of `iframe-md`

## Custom commands
### paste
Execute by typing `!!!paste` followed by a path to a file or URL.
Will simply replace the command with the raw file contents before getting rerendered as MD
Executes first out of all three commands. Put a fourth exclamation mark in the beginning to remove the whitespace after the paste command. If you want to have no whitespace before the paste, simply delete it.

### iframe
Execute by typing `!!!iframe` followed by a path to a file or URL to iframe, if its an MD file, it will render it
Simply replaces the command with an iframe tag

### import
Execute by typing `!!!iframe` followed by a path to a file or URL. Will attempt to convert an html page into MD before rendering it
Will replace the command with rendered MD

## MD files
This plugin also allows you to "iframe" an MD file, which will include its code in the document (can be another document or an online source). You can also name the iframe with a "iframe-md" class to attempt to convert html to md

## Filesystem Access
- Starting a src with "/" will start from the root of your vault
- Starting without a slash will use relative directories from the current MD file
- If youd like to use a file outside of your valut, prefix the src with "file://"

## Examples
### Importing MD files with the \<iframe> tag
To use, just use the src attribute in an iframe tag:
![image](https://user-images.githubusercontent.com/62992267/166679372-ca3e8dcb-b5ce-47a0-b49a-09d71478f185.png)

Produced with the following MD:
```
# Stuff outside the iframe
- Example list

<iframe src="https://raw.githubusercontent.com/tnichols217/obsidian-columns/main/README.md" style="width: 100%; padding:50px"></iframe>
```

### Importing a website and converting it to MD
![image](https://user-images.githubusercontent.com/62992267/166702025-36436b98-5ef6-432e-a6bd-4b22a3afe247.png)

Produced with the following MD:
```
# Stuff outside the iframe
- Example list

<iframe src="https://linux.die.net/man/1/curl" class="iframe-md" style="margin: 50px"></iframe>
```

### Using the `!!!import` command
![image](https://user-images.githubusercontent.com/62992267/167250059-9ac70547-69b2-4658-850f-139312317d09.png)

Produced with the following MD:
```md
# This is file example.md
**Here I import example1.md:**

!!!import example1.md

**Here i import it again:**

!!!import example1.md
```

### Using the `!!!paste` command
![image](https://user-images.githubusercontent.com/62992267/167250122-08d6bdb2-af5a-44be-a079-ea0dc381a674.png)

Produced with the following MD:
```md
# This is file exmaple.md

My name is !!!paste Myname.md
```

### Using `!!!paste` to load a file defined in another file
![image](https://user-images.githubusercontent.com/62992267/167250215-48cecc36-de1b-4303-b36a-d1eae135bf75.png)

The filename to be imported is defined inside the fileToLoad.md file

```md
# This is file exmaple.md

!!!import !!!paste fileToLoad.md
```

## Settings
### Allow Internet
Allows the plugin to include MD files from the internet.

### Recursion Depth
Blocks recursive imports past this depth. 
