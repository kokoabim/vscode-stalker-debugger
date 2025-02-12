import "bootstrap";
import $ from "jquery";

const timeLoaded = new Date().toLocaleTimeString();

$(() => {
    console.log('Time loaded: ', timeLoaded);
});
