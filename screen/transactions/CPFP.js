/* global alert */
import React, { Component } from 'react';
import { ActivityIndicator, View, TextInput, TouchableOpacity, Linking, Clipboard } from 'react-native';
import { BlueSpacing20, BlueButton, SafeBlueArea, BlueCard, BlueText, BlueSpacing, BlueNavigationStyle } from '../../BlueComponents';
import PropTypes from 'prop-types';
import { HDSegwitBech32Transaction, HDSegwitBech32Wallet } from '../../class';
import { Icon, Text } from 'react-native-elements';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
/** @type {AppStorage} */
let EV = require('../../events');
let BlueElectrum = require('../../BlueElectrum');
let loc = require('../../loc');

export default class CPFP extends Component {
  static navigationOptions = () => ({
    ...BlueNavigationStyle(null, false),
    title: 'Bump fee (CPFP)',
  });

  constructor(props) {
    super(props);
    let txid;
    let wallet;
    if (props.navigation.state.params) txid = props.navigation.state.params.txid;
    if (props.navigation.state.params) wallet = props.navigation.state.params.wallet;

    this.state = {
      isLoading: true,
      stage: 1,
      txid,
      wallet,
    };
  }

  broadcast() {
    this.setState({ isLoading: true }, async () => {
      try {
        await BlueElectrum.ping();
        await BlueElectrum.waitTillConnected();
        let result = await this.state.wallet.broadcastTx(this.state.txhex);
        if (result) {
          console.log('broadcast result = ', result);
          EV(EV.enum.REMOTE_TRANSACTIONS_COUNT_CHANGED); // someone should fetch txs
          this.setState({ stage: 3 });
        } else {
          ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
          this.setState({ isLoading: false });
          alert('Broadcast failed');
        }
      } catch (error) {
        ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
        this.setState({ isLoading: false });
        alert(error.message);
      }
    });
  }

  async componentDidMount() {
    console.log('transactions/CPFP - componentDidMount');
    this.setState({
      isLoading: true,
      newFeeRate: '',
      nonReplaceable: false,
    });
    await this.checkPossibilityOfCPFP();
  }

  async checkPossibilityOfCPFP() {
    if (this.state.wallet.type !== HDSegwitBech32Wallet.type) {
      return this.setState({ nonReplaceable: true, isLoading: false });
    }

    let tx = new HDSegwitBech32Transaction(null, this.state.txid, this.state.wallet);
    if ((await tx.isToUsTransaction()) && (await tx.getRemoteConfirmationsNum()) === 0 && (await tx.isSequenceReplaceable())) {
      let info = await tx.getInfo();
      return this.setState({ nonReplaceable: false, feeRate: info.feeRate, isLoading: false, tx });
    } else {
      return this.setState({ nonReplaceable: true, isLoading: false });
    }
  }

  async createTransaction() {
    const newFeeRate = parseInt(this.state.newFeeRate);
    if (newFeeRate > this.state.feeRate) {
      /** @type {HDSegwitBech32Transaction} */
      const tx = this.state.tx;
      this.setState({ isLoading: true });
      try {
        let { tx: newTx } = await tx.createCPFPbumpFee(newFeeRate);
        this.setState({ stage: 2, txhex: newTx.toHex() });
        this.setState({ isLoading: false });
      } catch (_) {
        this.setState({ isLoading: false });
        alert('Failed');
      }
    }
  }

  render() {
    if (this.state.isLoading) {
      return (
        <View style={{ flex: 1, paddingTop: 20 }}>
          <ActivityIndicator />
        </View>
      );
    }

    if (this.state.stage === 3) {
      return (
        <SafeBlueArea style={{ flex: 1, paddingTop: 19 }}>
          <BlueCard style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', paddingTop: 76, paddingBottom: 16 }} />
          </BlueCard>
          <View
            style={{
              backgroundColor: '#ccddf9',
              width: 120,
              height: 120,
              borderRadius: 60,
              alignSelf: 'center',
              justifyContent: 'center',
              marginTop: 43,
              marginBottom: 53,
            }}
          >
            <Icon name="check" size={50} type="font-awesome" color="#0f5cc0" />
          </View>
          <BlueCard>
            <BlueButton
              onPress={() => {
                this.props.navigation.popToTop();
              }}
              title={loc.send.success.done}
            />
          </BlueCard>
        </SafeBlueArea>
      );
    }

    if (this.state.stage === 2) {
      return (
        <View style={{ flex: 1, paddingTop: 20 }}>
          <BlueCard style={{ alignItems: 'center', flex: 1 }}>
            <BlueText style={{ color: '#0c2550', fontWeight: '500' }}>{loc.send.create.this_is_hex}</BlueText>
            <TextInput
              style={{
                borderColor: '#ebebeb',
                backgroundColor: '#d2f8d6',
                borderRadius: 4,
                marginTop: 20,
                color: '#37c0a1',
                fontWeight: '500',
                fontSize: 14,
                paddingHorizontal: 16,
                paddingBottom: 16,
                paddingTop: 16,
              }}
              height={112}
              multiline
              editable
              value={this.state.txhex}
            />

            <TouchableOpacity style={{ marginVertical: 24 }} onPress={() => Clipboard.setString(this.state.txhex)}>
              <Text style={{ color: '#9aa0aa', fontSize: 15, fontWeight: '500', alignSelf: 'center' }}>Copy and broadcast later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginVertical: 24 }}
              onPress={() => Linking.openURL('https://coinb.in/?verify=' + this.state.txhex)}
            >
              <Text style={{ color: '#9aa0aa', fontSize: 15, fontWeight: '500', alignSelf: 'center' }}>Verify on coinb.in</Text>
            </TouchableOpacity>
            <BlueButton onPress={() => this.broadcast()} title={loc.send.confirm.sendNow} />
          </BlueCard>
        </View>
      );
    }

    if (this.state.nonReplaceable) {
      return (
        <SafeBlueArea style={{ flex: 1, paddingTop: 20 }}>
          <BlueSpacing20 />
          <BlueSpacing20 />
          <BlueSpacing20 />
          <BlueSpacing20 />
          <BlueSpacing20 />

          <BlueText h4>This transaction is not bumpable</BlueText>
        </SafeBlueArea>
      );
    }

    return (
      <SafeBlueArea style={{ flex: 1, paddingTop: 20 }}>
        <BlueSpacing />
        <BlueCard style={{ alignItems: 'center', flex: 1 }}>
          <BlueText>
            We will create another transaction that spends your unconfirmed transaction. Total fee will be higher than original transaction
            fee, so it should be mined faster. This is called CPFP - Child Pays For Parent.
          </BlueText>
          <BlueSpacing20 />

          <View
            style={{
              flexDirection: 'row',
              borderColor: '#d2d2d2',
              borderBottomColor: '#d2d2d2',
              borderWidth: 1.0,
              borderBottomWidth: 0.5,
              backgroundColor: '#f5f5f5',
              minHeight: 44,
              height: 44,
              alignItems: 'center',
              marginVertical: 8,
              borderRadius: 4,
            }}
          >
            <TextInput
              onChangeText={text => this.setState({ newFeeRate: text })}
              keyboardType={'numeric'}
              placeholder={'total fee rate (satoshi per byte) you want to pay'}
              value={this.state.newFeeRate + ''}
              style={{ flex: 1, minHeight: 33, marginHorizontal: 8 }}
            />
          </View>

          <BlueText>Should be bigger than {this.state.feeRate} sat/byte</BlueText>
          <BlueSpacing />
          <BlueButton onPress={() => this.createTransaction()} title="Create" />
        </BlueCard>
      </SafeBlueArea>
    );
  }
}

CPFP.propTypes = {
  navigation: PropTypes.shape({
    popToTop: PropTypes.func,
    navigate: PropTypes.func,
    state: PropTypes.shape({
      params: PropTypes.shape({
        txid: PropTypes.string,
        wallet: PropTypes.object,
      }),
    }),
  }),
};