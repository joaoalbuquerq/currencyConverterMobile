import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';

// INTERFACE PARA MODELAR A RESPOSTA E CONVERTER PARA UM TIPO PERSONALIZADO MOEDA
interface Moeda{
  codigo: string;
  nome: string;
}

// INTERFACE PARA MODELAR A RESPOSTA DA API E CONVERTER PARA UM TIPO PERSONALIZADO TAXACAMBIO
interface TaxaCambio{
  [key:string]:number;
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {

  // Definição de variaveis a serem usadas na conversão
  soma: number=0;
  moedaOrigem: string = 'USD';
  moedaDestino: string = 'BRL';
  resultado: number = 0;

  // Variaveis utilizadas para a resposta da pesquisa da API
  moedas: Moeda[] = [];
  taxasCambio: TaxaCambio = {};

  //Filtros
  moedasFiltradas: Moeda[] = [];
  moedasParaFiltro: Moeda[] = [];
  termoPesquisaInicial: string = '';
  termoPesquisaFinal: string = '';

  // Estados da tela
  carregando: boolean = false;
  ultimaAtualizacao: string = "";


  // Dados da API
  private apiKey = "47baa309f75101cea3287a40";
  private baseUrl = "https://v6.exchangerate-api.com/v6/"

  constructor(
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit(){
    this.carregarMoedas();
  }

  atualizarTaxas(){
    this.carregarTaxasCambio();
  }

  async carregarMoedas(){
    const caregandoMoedas = await this.loadingCtrl.create({
      message: 'Carregando moedas...'
    });
    await caregandoMoedas.present();

    try {
      const respostaApi: any = await this.http.get(
        `${this.baseUrl}/${this.apiKey}/codes`
      ).toPromise();

      this.moedas = respostaApi.supported_codes.map((item: any[]) => ({
        codigo: item[0],
        nome: item[1]
      }));

      this.moedasFiltradas = [...this.moedas];
      this.moedasParaFiltro = [...this.moedas];

      await this.carregarTaxasCambio();

    } catch (error) {
      console.log('Erro ao carregar moedas: ', error);
      await this.showAlert('Erro','Não foi possível carregar as moedas')
    }
  }

  async carregarTaxasCambio(){
    this.carregando = true;

    try {

      const respostaApi: any = await this.http.get(
        `${this.baseUrl}/${this.apiKey}/latest/${this.moedaOrigem}`
      ).toPromise();

      this.taxasCambio = respostaApi.conversion_rates;
      this.ultimaAtualizacao = new Date().toLocaleString('pt-BR');
      
    } catch (error) {
      console.log("Erro ao carregar as taxas de cambio: ", error);
      await this.showAlert('Erro', 'Não foi possivel atualizar as taxas de cambio');
    }

    this.carregando = false;
  }

  async calcularConversao(){
    if(!this.soma || this.soma <= 0){
      await this.showAlert('Atenção', 'Por favor, informe um valor maior que zero');
      return;
    }

    if(!this.taxasCambio[this.moedaDestino]){
      await this.showAlert('Erro','Taxa de cambio não disponível');
      return;
    }

    const taxa = this.taxasCambio[this.moedaOrigem];
    this.resultado = this.soma * taxa;
  }

    private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  get obterTaxaCambioAtual():number{
    return this.taxasCambio[this.moedaDestino]?.valueOf() || 0;
  }

}
