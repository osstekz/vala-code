# PPA repository for Vala-Code packages:
vala-code-amd64.deb

#Install for Debian and Ubuntu based distributions
curl -SsL https://osstekz.github.io/vala-code/ppa/ubuntu/ | sudo apt-key add -
sudo curl -SsL -o /etc/apt/sources.list.d/https://osstekz.github.io/vala-code/ppa/ubuntu/vala-code.list
sudo apt update
sudo apt install vala-code

