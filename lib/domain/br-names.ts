/**
 * Lista compacta de prenomes brasileiros comuns.
 *
 * Serve só como uma das pistas da varredura de nomes no texto livre — uma
 * palavra capitalizada no meio da frase que também esteja nesta lista é forte
 * candidata a nome de pessoa. Não pretende ser exaustiva: os nomes que
 * escapam daqui são pegos pela regra de capitalização e confirmados na tela
 * de revisão.
 *
 * Tudo em minúsculas e sem acento — a comparação normaliza os dois lados.
 */
export const BR_GIVEN_NAMES: ReadonlySet<string> = new Set([
  'ana','maria','joao','jose','antonio','francisco','carlos','paulo','pedro','lucas',
  'luiz','marcos','luis','gabriel','rafael','daniel','marcelo','bruno','eduardo','felipe',
  'raimundo','rodrigo','manoel','nelson','roberto','fabio','alexandre','gustavo','leonardo','andre',
  'fernando','sergio','ricardo','wesley','adriano','mateus','matheus','vinicius','thiago','tiago',
  'guilherme','henrique','arthur','artur','davi','david','bernardo','miguel','heitor','theo',
  'lorenzo','gael','ravi','noah','samuel','enzo','joaquim','benjamin','benicio','anthony',
  'isaac','caleb','murilo','pietro','nicolas','cauã','cauan','yuri','ryan','diego','diego',
  'juliana','fernanda','patricia','aline','sandra','camila','amanda','bruna','jessica','leticia',
  'julia','luiza','luisa','beatriz','manuela','sofia','sophia','helena','valentina','laura',
  'isabella','isabela','heloisa','luana','livia','giovanna','maria eduarda','cecilia','eloa','isadora',
  'mariana','vitoria','vitória','larissa','carolina','gabriela','rafaela','bianca','yasmin','rebeca',
  'clara','alice','antonella','maite','maya','ayla','elis','aurora','olivia','marina',
  'carla','claudia','simone','vanessa','tatiane','tatiana','priscila','daniela','renata','michele',
  'michelle','cristiane','cristina','regina','rosa','rita','angela','fatima','luciana','lucia',
  'marta','marlene','celia','sonia','sueli','vera','teresa','tereza','madalena','conceicao',
  'aparecida','francisca','raimunda','sebastiana','geralda','terezinha','joana','catarina','agatha','agata',
  'emanuelly','emanuel','emilly','emily','kaua','kauan','kauê','kaue','otavio','otávio',
  'augusto','caio','ian','igor','breno','bryan','erick','erik','kevin','iago',
  'washington','wellington','jefferson','anderson','emerson','edson','denis','dennis','alan','allan',
  'wallace','william','willian','pablo','italo','ítalo','cesar','césar','elias','isaias',
  'moises','moisés','abel','abraao','abraão','tomas','tomás','lucca','luca','vicente','valentim',
])

/** Sobrenomes muito frequentes — reforçam a detecção quando vêm após um prenome. */
export const BR_SURNAMES: ReadonlySet<string> = new Set([
  'silva','santos','oliveira','souza','sousa','lima','pereira','ferreira','costa','rodrigues',
  'almeida','nascimento','carvalho','araujo','araújo','ribeiro','gomes','martins','rocha','alves',
  'monteiro','mendes','barbosa','barros','freitas','cardoso','dias','castro','campos','cavalcanti',
  'cavalcante','dantas','moreira','nunes','marques','machado','moraes','morais','teixeira','correia',
  'correa','corrêa','pinto','miranda','ramos','goncalves','gonçalves','vieira','fernandes','lopes',
  'melo','mello','azevedo','fonseca','farias','pires','borges','medeiros','andrade','batista',
  'bezerra','aguiar','tavares','cunha','reis','xavier','sena','franca','frança','matos',
])
