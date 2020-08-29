## PPA repository for Vala-Code packages:
vala-code-amd64.deb

## Install for Debian and Ubuntu based distributions
    curl -s --compressed https://raw.githubusercontent.com/osstekz/vala-code/master/ppa/ubuntu/KEY.gpg | sudo apt-key add -
    sudo curl -s --compressed -o /etc/apt/sources.list.d/vala-code.list https://raw.githubusercontent.com/osstekz/vala-code/master/ppa/ubuntu/vala-code.list
    sudo apt update
    sudo apt install vala-code

