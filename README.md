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

### inline
Execute by typing `!!!inline` followed by a path to a file or URL. Will insert the html file into where the command was called from inline
Similar to paste, it also has the additional `!` for removing the space afterwards

## MD files
This plugin also allows you to "iframe" an MD file, which will include its code in the document (can be another document or an online source). You can also name the iframe with a "iframe-md" class to attempt to convert html to md

## Filesystem Access
- Starting a src with "/" will start from the root of your vault
- Starting without a slash will use relative directories from the current MD file
- Files outside your vault cannot be accessed due to a limitation in the obsidian dataAdapter API

## Examples


## Settings
### Allow Internet
Allows the plugin to include MD files from the internet.

### Allow inline
Allows access to the inline command\
Insecure because it allows arbitrary HTML (and js) code to run

### Recursion Depth
Blocks recursive imports past this depth. 

### Cache Local Files
Cache local files instead of rereading upon every update\
Remote files are always cached

### Cache refresh time (milliseconds)
How old a cache item has to be before it is reloaded

If you enjoy my plugin, please consider supporting me:

<a href="https://www.buymeacoffee.com/tnichols217" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60" /></a>
