import {AppState, StatusBar} from 'react-native';
import {Asset, AppLoading} from 'expo';
import React, { Component } from 'react';



const stories=[
    {
        id:"2",
        source: require('./assets/stories/2.jpg'),
        user: 'mad_man',
        avatar: require(''),

    },
    {
        id:"4",
        source: require('./assets/stories/2.jpg'),
        user: 'mad_man',
        avatar: require(''),

    },
    {
        id:"5",
        source: require('./assets/stories/2.jpg'),
        user: 'mad_man',
        avatar: require(''),

    },
    {
        id:"6",
        source: require('./assets/stories/2.jpg'),
        user: 'mad_man',
        avatar: require(''),

    },
    {
        id:"7",
        source: require('./assets/stories/2.jpg'),
        user: 'mad_man',
        avatar: require(''),

    },
    {
        id:"8",
        source: require('./assets/stories/2.jpg'),
        user: 'mad_man',
        avatar: require(''),

    },

];

type AppState={
    ready :boolean,
};

export default class App React.Component<{},AppState>{
    state={
        ready:false,
    };
    async ComponentDidMount(){
        await Promise.all(stories.map(story=>
            Promise,all([
                Asset.loadAsync(story.source),
                Asset.loadAsync(story.avatar),

            ])));
        this.setState({ready:true});
    }

}