@echo off
REM 这是一个批处理脚本，用于将当前文件夹的完整文件结构输出到 FileStructure.txt 文件中。

REM 设置输出文件的名称
set OutputFile=FileStructure.txt

REM 使用 tree 命令生成文件结构，并将输出重定向到文件
REM /F 参数会显示每个文件夹中的文件名
REM /A 参数使用 ASCII 字符代替扩展字符，以获得更好的兼容性
tree /F /A > %OutputFile%

REM 提示用户操作已完成
echo 文件结构已成功输出到 %OutputFile%

REM （可选）使用 notepad 打开生成的文件
REM start notepad %OutputFile%

REM 暂停脚本，以便用户可以看到消息 (按任意键继续)
pause
