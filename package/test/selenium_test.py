#!/usr/bin/python3

import os
import sys
import threading
import time
from argparse import ArgumentParser
from http.server import HTTPServer, SimpleHTTPRequestHandler

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


class SimpleHttpServer(threading.Thread):
    def __init__(self, host='localhost', port=4001, path='.'):
        self._base_url = f'http://{host}:{port}'
        self._root_path = path
        self._cwd = os.getcwd()
        self._server = HTTPServer((host, port), SimpleHTTPRequestHandler)
        super().__init__(daemon=True)

    @property
    def base_url(self):
        return self._base_url

    def run(self):
        os.chdir(self._root_path)
        print(f'starting server on port {self._server.server_port}')
        self._server.serve_forever()

    def stop(self):
        os.chdir(self._cwd)
        self._server.shutdown()
        self._server.socket.close()
        print(f'stopping server on port {self._server.server_port}')


def run_unit_test_selenium(
        url,
        pcm_file,
        ref_file,
        input_frequency,
        output_frequency,
        filter_order
):

    base_folder = os.path.join(os.path.dirname(__file__), '..', '..')
    pcm_file_absolute_path = os.path.abspath(os.path.join(base_folder, 'audio', pcm_file))
    ref_file_absolute_path =os.path.abspath(os.path.join(base_folder, 'audio', ref_file))

    desired_capabilities = DesiredCapabilities.CHROME
    desired_capabilities['goog:loggingPrefs'] = {'browser': 'ALL'}
    opts = Options()
    opts.headless = True

    driver = webdriver.Chrome(ChromeDriverManager().install(
    ), desired_capabilities=desired_capabilities, options=opts)

    driver.get(url)

    wait = WebDriverWait(driver, 20)

    driver.find_element_by_id("pcmFile").send_keys(pcm_file_absolute_path)
    wait.until(EC.visibility_of_element_located((By.ID, "pcmFileLoaded")))

    driver.find_element_by_id("refPcmFile").send_keys(ref_file_absolute_path)
    wait.until(EC.visibility_of_element_located((By.ID, "refPcmFileLoaded")))

    driver.find_element_by_id("filterOrder").send_keys(filter_order)
    driver.find_element_by_id("inputFrequency").send_keys(input_frequency)
    driver.find_element_by_id("outputFrequency").send_keys(output_frequency)

    driver.find_element_by_id("submit").click()
    wait.until(EC.visibility_of_element_located((By.ID, "testComplete")))

    test_result = 1
    test_message = "Tests failed"
    for entry in driver.get_log('browser'):
        print(entry['message'])
        if 'Test passed!' in entry['message']:
            test_message = "Tests passed"
            test_result = 0

    driver.close()
    print(test_message)
    return test_result


def main():

    simple_server = SimpleHttpServer(
        port=4005, path=os.path.join(os.path.dirname(__file__), '..', '..'))
    test_url = f'{simple_server.base_url}/package/test/index.html'
    simple_server.start()
    time.sleep(10)

    result = 0
    try:
        result += run_unit_test_selenium(
            test_url,
            '9khz_noise_48kHz.pcm',
            '9khz_noise_16kHz_ds_30.pcm',
            48000,
            16000,
            30)
        result += run_unit_test_selenium(
            test_url,
            '9khz_noise_48kHz.pcm',
            '9khz_noise_16kHz_ds_40.pcm',
            48000,
            16000,
            40)
        result += run_unit_test_selenium(
            test_url,
            '9khz_noise_48kHz.pcm',
            '9khz_noise_16kHz_ds_50.pcm',
            48000,
            16000,
            50)
        result += run_unit_test_selenium(
            test_url,
            'tone-9khz_noise-44.1khz_mono.pcm',
            'tone-9khz_noise-44.1khz_mono_ds_100.pcm',
            44100,
            16000,
            100)
    except WebDriverException as e:
        print(e)
        result = 1
    finally:
        simple_server.stop()
        sys.exit(result)


if __name__ == '__main__':
    main()
