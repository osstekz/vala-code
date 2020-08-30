## PPA repository for Vala-Code packages:
vala-code-amd64.deb

## Install for Debian and Ubuntu based distributions
#####Step 1. Add the PPA key to your packaging system:
    curl -s --compressed https://raw.githubusercontent.com/osstekz/vala-code/master/ppa/ubuntu/KEY.gpg | sudo apt-key add -
    sudo curl -s --compressed -o /etc/apt/sources.list.d/vala-code.list https://raw.githubusercontent.com/osstekz/vala-code/master/ppa/ubuntu/vala-code.list
    sudo apt update
#####Step 2. Install a package:
    sudo apt install vala-code

