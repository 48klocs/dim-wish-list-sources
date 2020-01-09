BEGIN{clearLine=1;pvp=0;pve=0;noted=0}
/\/\/notes:/{noted=1}
/\/\/.*[pP][vV][Pp]/{pvp=1}
/\/\/.*[pP][vV][Ee]/{pve=1}
/dimwishlist/&&clearLine&&pvp&&!noted{clearLine=0; pvp=0; pve=0; print("//notes: PvP Pick")}
/dimwishlist/&&clearLine&&pve&&!noted{clearLine=0; pve=0; pvp=0; print("//notes: PvE Pick")}
/^\s*$/{clearLine=1; noted=0;pve=0;pvp=0;}{print $0}
